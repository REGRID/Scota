const fs = require('fs');
const path = require('path');
const https = require('https');
const tls = require('tls');
const { Pool } = require('pg');

// 1. Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
let dbUrl = '';
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k === 'DATABASE_URL' || k === 'POSTGRES_URL') {
        dbUrl = v;
      }
    }
  }
}

async function request(url) {
  const start = Date.now();
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          latencyMs: Date.now() - start,
          server: res.headers['server'] || '-',
          hsts: !!res.headers['strict-transport-security'],
          cache: res.headers['x-nextjs-cache'] || res.headers['cache-control'] || '-',
          bodyLength: data.length,
          data,
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        status: 'ERR',
        latencyMs: Date.now() - start,
        error: err.message,
      });
    });
  });
}

async function checkSsl() {
  return new Promise((resolve) => {
    const socket = tls.connect(443, 'scota.web.id', { servername: 'scota.web.id' }, () => {
      const cert = socket.getPeerCertificate();
      const daysLeft = Math.round((new Date(cert.valid_to) - Date.now()) / (1000 * 60 * 60 * 24));
      socket.end();
      resolve({
        valid: true,
        issuer: cert.issuer ? cert.issuer.O || cert.issuer.CN : 'Unknown',
        validTo: cert.valid_to,
        daysLeft,
      });
    });
    socket.on('error', (err) => {
      resolve({ valid: false, error: err.message });
    });
  });
}

async function checkDb() {
  if (!dbUrl) return { connected: false, reason: 'DATABASE_URL not found' };

  const pool = new Pool({
    connectionString: dbUrl.replace(/\?.*$/, ''),
    ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('.cloud') || dbUrl.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 7000,
  });

  try {
    const start = Date.now();
    const client = await pool.connect();
    const pingTime = Date.now() - start;

    const versionRes = await client.query('SELECT version();');
    const dbVersion = versionRes.rows[0].version.split(' on ')[0];

    const connRes = await client.query('SELECT state, backend_type, count(*)::int as count FROM pg_stat_activity GROUP BY state, backend_type ORDER BY count DESC;');
    const connections = connRes.rows;

    const sizeRes = await client.query('SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;');
    const dbSize = sizeRes.rows[0].db_size;

    const cacheRes = await client.query(
      'SELECT round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0)), 2) as hit_ratio FROM pg_stat_database WHERE datname = current_database();'
    );
    const hitRatio = cacheRes.rows[0]?.hit_ratio || 'N/A';

    const tenantCountRes = await client.query('SELECT count(*) as count FROM public.tenants;');
    const receiptCountRes = await client.query('SELECT count(*) as count FROM public.receipts;');

    client.release();
    await pool.end();

    return {
      connected: true,
      pingTimeMs: pingTime,
      version: dbVersion,
      connections,
      dbSize,
      cacheHitRatio: hitRatio + '%',
      totalTenants: tenantCountRes.rows[0].count,
      totalReceipts: receiptCountRes.rows[0].count,
    };
  } catch (e) {
    await pool.end();
    return { connected: false, error: e.message };
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('🩺 SCOTA VPS & SYSTEM HEALTH AUDIT');
  console.log('='.repeat(60));

  // 1. SSL
  const ssl = await checkSsl();
  console.log('\n🔒 [1] SSL/TLS Certificate:');
  if (ssl.valid) {
    console.log(`   - Status: VALID`);
    console.log(`   - Issuer: ${ssl.issuer}`);
    console.log(`   - Valid until: ${ssl.validTo} (${ssl.daysLeft} days remaining)`);
  } else {
    console.log(`   - Status: INVALID (${ssl.error})`);
  }

  // 2. HTTP Endpoints
  console.log('\n🌐 [2] HTTP Endpoint Response & Latency:');
  const urls = [
    'https://scota.web.id/',
    'https://scota.web.id/api/ping',
    'https://scota.web.id/login',
    'https://scota.web.id/pricing',
    'https://scota.web.id/superadmin/login',
    'https://scota.web.id/robots.txt',
    'https://scota.web.id/sitemap.xml',
  ];

  for (const u of urls) {
    const res = await request(u);
    const icon = res.status === 200 ? '✅' : '⚠️';
    console.log(`   ${icon} ${res.status} [${res.latencyMs}ms] ${u} (Server: ${res.server})`);
  }

  // 3. Database Health
  console.log('\n🗄️ [3] PostgreSQL Database Health:');
  const db = await checkDb();
  if (db.connected) {
    console.log(`   - Status: CONNECTED (${db.pingTimeMs}ms)`);
    console.log(`   - Version: ${db.version}`);
    console.log(`   - Database Size: ${db.dbSize}`);
    console.log(`   - Cache Hit Ratio: ${db.cacheHitRatio}`);
    console.log(`   - Total Registered Tenants: ${db.totalTenants}`);
    console.log(`   - Total Synced Receipts: ${db.totalReceipts}`);
    console.log(`   - Connections:`, db.connections.map(c => `${c.backend_type} (${c.state || 'system'}): ${c.count}`).join(', '));
  } else {
    console.log(`   - Status: DISCONNECTED (${db.error || db.reason})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ AUDIT COMPLETE');
  console.log('='.repeat(60));
}

run();

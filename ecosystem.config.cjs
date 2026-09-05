const fs = require('fs');
const path = require('path');

const envVars = {
  NODE_ENV: 'production',
  PORT: 3000,
};

// Auto-load .env.local into PM2 process environment
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    }
  } catch (e) {
    console.warn('Could not parse .env.local for PM2:', e);
  }
}

module.exports = {
  apps: [
    {
      name: 'scota',
      cwd: '/var/www/scota',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 200,
      env: envVars,
    },
  ],
};

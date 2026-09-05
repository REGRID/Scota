#!/usr/bin/env bash
set -e

APP_DIR="/var/www/scota"
echo "=========================================="
echo "🚀 Starting Automated Deployment for SCOTA"
echo "=========================================="

cd "$APP_DIR" || { echo "❌ Directory $APP_DIR not found!"; exit 1; }

# Validasi Pre-flight: Pastikan .env.local ada dan memiliki SESSION_SECRET yang aman
if [ -f .env.local ]; then
    if ! grep -q "SESSION_SECRET=" .env.local; then
        echo "⚠️ SESSION_SECRET belum ada di .env.local! Menghasilkan kunci kriptografis aman..."
        SEC=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
        echo -e "\nSESSION_SECRET=\"$SEC\"" >> .env.local
        echo "✅ SESSION_SECRET baru berhasil disuntikkan ke .env.local"
    fi
else
    echo "❌ Error: File .env.local tidak ditemukan di $APP_DIR!"
    exit 1
fi

echo "📥 [1/5] Fetching latest changes from GitHub..."
git fetch origin main
git reset --hard origin/main

echo "📦 [2/5] Ensuring dependencies are installed..."
npm install --legacy-peer-deps

echo "🗄️ [2.5/5] Syncing database schema & running migrations..."
node scripts/setup-postgres.js
node scripts/migrate-json-logs-to-db.js

echo "🔨 [3/5] Building Next.js production bundle..."
npm run build

echo "🔄 [4/5] Reloading PM2 via ecosystem config..."
if pm2 describe scota > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi
pm2 save

echo "🩺 [5/5] Performing Health Check on port 3000..."
sleep 4
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 || echo "000")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 307 ] || [ "$HTTP_CODE" -eq 308 ] || [ "$HTTP_CODE" -eq 302 ]; then
    echo "✅ SUCCESS: Application is ONLINE and healthy! (HTTP Status: $HTTP_CODE)"
else
    echo "⚠️ WARNING: Health check returned HTTP $HTTP_CODE."
    echo "Last PM2 logs:"
    pm2 logs scota --lines 20 --nostream
fi
echo "=========================================="

#!/bin/bash
# Exit immediately if any command exits with a non-zero status
set -e

echo "🚀 Starting Backend Deployment Script"

# 1. Load Node Version Manager (NVM)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 2. Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 3. Generate Prisma client
echo "🧬 Generating Prisma client..."
npx prisma generate

# 4. Apply Database Migrations
echo "🗄️ Running DB migrations..."
npx prisma migrate deploy

# 5. Build NestJS application
echo "🏗️ Building NestJS project..."
pnpm run build

# 6. Reload application via PM2 with zero downtime
echo "🔄 Reloading backend application via PM2..."
if pm2 describe gbi-backend > /dev/null 2>&1; then
  echo "✅ Application running. Reloading with zero downtime..."
  pm2 reload ecosystem.config.js --env production
else
  echo "⚠️ Application not running. Starting new instance..."
  pm2 start ecosystem.config.js --env production
fi

echo "✅ Backend Deployment Completed Successfully!"

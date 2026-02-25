#!/bin/sh
# File: scripts/docker-entrypoint.sh

set -e

echo "🚀 Starting Bluesix Frontend..."

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3222}"

if [ -z "$AUTH_SECRET" ]; then
  echo "⚠️  Warning: AUTH_SECRET may be unset. The app may exit if env validation fails."
fi

if [ "$NODE_ENV" = "production" ]; then
  echo "📦 Production mode detected"

  if [ -n "$DATABASE_URL" ] || [ -n "$DB_HOST" ]; then
    if [ -f "/app/drizzle.config.ts" ] && [ -f "/app/src/server/db/schema.ts" ]; then
      echo "🔄 Running db:push..."
      cd /app
      npm run db:push || echo "⚠️  db:push warning (may be expected)"
    else
      echo "ℹ️  Schema/config not in image, skipping db:push..."
    fi
  else
    echo "ℹ️  DATABASE_URL / DB_HOST not set, skipping db:push..."
  fi
fi

echo "✅ Starting application on $HOSTNAME:$PORT (node server.js)..."
cd /app && exec node server.js

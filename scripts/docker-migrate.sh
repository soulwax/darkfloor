#!/bin/sh
# File: scripts/docker-migrate.sh

set -e

echo "⏳ Waiting for database to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "db" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "✅ Database is ready!"

echo "🔄 Running database migrations..."
npm run db:migrate

echo "✅ Migrations completed!"

exec "$@"

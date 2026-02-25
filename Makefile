# File: Makefile

.PHONY: help build up down restart logs shell migrate clean up-local down-local db-shell

help:
	@echo "Bluesix Frontend - Docker Commands"
	@echo ""
	@echo "🌐 Production (External Database - Neon/Aiven):"
	@echo "  make build      - Build Docker images"
	@echo "  make up         - Start app (uses external DB from .env)"
	@echo "  make down       - Stop app"
	@echo "  make restart    - Restart app"
	@echo "  make logs       - View application logs (follow)"
	@echo ""
	@echo "🐘 Production (Local PostgreSQL Database):"
	@echo "  make up-local   - Start app + local PostgreSQL"
	@echo "  make down-local - Stop all services"
	@echo "  make db-shell   - Access PostgreSQL CLI (local DB only)"
	@echo ""
	@echo "📦 Utilities:"
	@echo "  make shell      - Access app container shell"
	@echo "  make migrate    - Run database migrations"
	@echo "  make clean      - Remove all containers, volumes, and images"
	@echo ""
	@echo "ℹ️  Default commands use external database (Neon/Aiven)"
	@echo "ℹ️  Use '-local' suffix for local PostgreSQL database"

build:
	docker compose build

up:
	docker compose up -d
	@echo "✅ App started (external database). Access at http://localhost:3222"

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f app

shell:
	docker compose exec app sh

migrate:
	docker compose exec app npx drizzle-kit push

up-local:
	docker compose -f docker-compose.local.yml up -d
	@echo "✅ Services started (local database). Access at http://localhost:3222"

down-local:
	docker compose -f docker-compose.local.yml down

db-shell:
	docker compose -f docker-compose.local.yml exec db psql -U bluesix -d bluesix

clean:
	@echo "⚠️  WARNING: This will remove all containers, volumes, and images!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v 2>/dev/null || true; \
		docker compose -f docker-compose.local.yml down -v 2>/dev/null || true; \
		docker system prune -a -f; \
		echo "✅ Cleanup complete"; \
	else \
		echo "❌ Cleanup cancelled"; \
	fi

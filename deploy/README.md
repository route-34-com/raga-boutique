# Deploying to a DigitalOcean droplet

Plan: one droplet (Bangalore, Ubuntu 24.04) running Postgres 16, the FastAPI app and Caddy.

Rough memory: Postgres ~100-150 MB (with `postgres-lowmem.conf`), API 2 workers ~140 MB,
Caddy ~30 MB, Ubuntu ~250 MB. The $6 / 1 GB plan fits with a 1 GB swap file; move to 2 GB if traffic grows.
Turn on DigitalOcean backups.

## One-time setup
```bash
# as root
adduser --disabled-password raga
apt update && apt install -y postgresql-16 caddy python3-venv git
curl -LsSf https://astral.sh/uv/install.sh | sh          # uv for Python deps
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab

cp deploy/postgres-lowmem.conf /etc/postgresql/16/main/conf.d/raga-lowmem.conf && systemctl restart postgresql
sudo -u postgres psql -c "CREATE ROLE raga LOGIN PASSWORD '<strong password>'" -c "CREATE DATABASE raga OWNER raga"

mkdir -p /srv/raga && chown raga /srv/raga   # put the repo here as /srv/raga
```

## App
```bash
cd /srv/raga/backend
cp .env.example .env    # fill in: ENV=prod, DATABASE_URL, JWT_SECRET (openssl rand -hex 32), COOKIE_SECURE=true,
                        # OTP_PROVIDER=msg91, MSG91_AUTHKEY, MSG91_TEMPLATE_ID, CORS_ORIGINS=["https://your-domain"]
uv sync --no-dev
uv run alembic upgrade head
uv run python -m scripts.seed --admin 98XXXXXXXX     # catalog + owner's admin number (no demo orders)

cd ../frontend && npm ci && npm run build            # or build locally and copy dist/

cp ../deploy/raga-api.service /etc/systemd/system/ && systemctl enable --now raga-api
cp ../deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy
```

## Updating
```bash
cd /srv/raga && git pull
cd backend && uv sync --no-dev && uv run alembic upgrade head && sudo systemctl restart raga-api
cd ../frontend && npm ci && npm run build
```

## Backups beyond DO snapshots
Nightly `pg_dump` of the database plus `backend/uploads/` (product photos) to DO Spaces or another machine.

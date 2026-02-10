# WeMadeIt - Production Deployment Guide (Docker + Cloudflare Tunnel)

## Architecture Overview

WeMadeIt ships as a **single Docker container**:

```
┌──────────────────────────────────────────────┐
│           Single Docker Container            │
├──────────────────────────────────────────────┤
│                                              │
│  ┌───────────┐          ┌─────────────────┐  │
│  │   Nginx   │─────────▶│   Go API Server │  │
│  │  (Port 80)│          │ (127.0.0.1:8080)│  │
│  └───────────┘          └─────────────────┘  │
│       │                                      │
│       ├── Serves: Next.js static export      │
│       └── Proxies: /api/* to Go backend      │
│                                              │
│  Managed by Supervisor                        │
└──────────────────────────────────────────────┘
            │                    │
            ▼                    ▼
         ./data/              ./config/
    (SQLite database)      (settings file)
```

Key points:
- The frontend is a static Next.js export served by nginx.
- The browser calls `/api/...` on the same origin; nginx proxies those calls to the Go API.
- SQLite DB and settings are persisted via bind mounts (`./data`, `./config`).

## Files Added

```
wemadeit/
├── Dockerfile.production
├── docker-compose.production.yml
├── nginx.conf
├── supervisord.conf
└── DEPLOYMENT.md
```

## Quick Start (Production Mode)

Build + run:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

If you are replacing the legacy Rails container (which previously bound port `3019`), run:

```bash
just deploy
```

Open:
- App: `http://localhost:3019`
- API health: `http://localhost:3019/api/health`

Logs:

```bash
docker compose -f docker-compose.production.yml logs -f --tail=200
```

Stop:

```bash
docker compose -f docker-compose.production.yml down
```

## First-Run Admin User (Important)

On the very first boot (when there are no users in the DB yet), the server seeds an admin user.

Defaults (as currently set in `docker-compose.production.yml`):
- Email: `admin@wemadeit.local`
- Password: `admin`

For a real deployment, change these **before first boot**:

```yaml
environment:
  WEMADEIT_ADMIN_EMAIL: you@yourdomain.com
  WEMADEIT_ADMIN_PASSWORD: "a-long-unique-password"
  WEMADEIT_ADMIN_NAME: "Admin"
```

These variables are only used when the DB has **zero** users.

## Persistent Data

- SQLite DB lives at: `./data/wemadeit.sqlite3`
- Settings live at: `./config/config.json`

Backup:

```bash
cp data/wemadeit.sqlite3 data/wemadeit.sqlite3.backup
cp config/config.json config/config.json.backup
```

## Cloudflare Tunnel

You have two options:

### Option A: Host-managed `cloudflared` (recommended)

Run the app via docker-compose so it listens on `localhost:3019`, then configure your tunnel to route to:
- `http://localhost:3019`

### Option B: Run `cloudflared` in Docker

If you prefer tunnel-in-compose, add a `cloudflared` service and use a tunnel token (don’t commit it).

Example command (one-off):

```bash
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:3019
```

## Troubleshooting

Check running containers:

```bash
docker compose -f docker-compose.production.yml ps
```

Enter the container:

```bash
docker compose -f docker-compose.production.yml exec wemadeit sh
```

Supervisor status (inside the container):

```bash
supervisorctl status
```

If the UI loads but API calls fail:
- Verify nginx proxy works: `curl -fsS http://localhost:3019/api/health`
- Check API logs: `docker logs wemadeit --tail=200`

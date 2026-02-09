# WeMadeIt (Go API + Next.js)

This repo is being refactored to the same high-level architecture as `time_manage`:
- Go backend API (SQLite)
- Next.js frontend (Tailwind)
- No CLI component

## Dev

### One command (recommended)

```bash
just run
```

Stops/inspection:

```bash
just status
just logs
just stop
```

### Manual

Backend:

```bash
go run ./cmd/server
```

Optional flags:

```bash
go run ./cmd/server --addr :8080 --data ./.run/data --config ./.run/config.json
```

Frontend:

```bash
cd web
npm install
npm run dev
```

Env:
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8080`)

API:
- Health: `GET /api/health`
- State: `GET /api/state`
- Login: `POST /api/login` (returns `{ token, user }`)

Auth:
- Most endpoints require `Authorization: Bearer <token>`.
- Default dev login is seeded on first run:
  - `admin@wemadeit.local` / `admin`

## Legacy Rails App

The pre-refactor Rails app (including Docker/Kamal config) lives under `legacy/rails/`.

Legacy deploy helper:

```bash
just deploy-rails
```

## Cloudflare Tunnel (wemadeit)

The production-style Cloudflare tunnel for `wemadeit.aigil.dev` is managed by a macOS LaunchDaemon and uses `/etc/cloudflared/config-wemadeit.yml`.

Ports:
- Go API (dev default): `8080` (see `justfile`; may auto-pick a free port)
- Next.js (dev default): `3000`
- Legacy Rails: see `legacy/rails/docker-compose.yml` (older notes reference `3019`)

Keep Cloudflared metrics off the app port to avoid conflicts.

Setup or fix:

```bash
sudo /bin/sh -c "sed -i '' 's/^metrics:.*/metrics: localhost:9399/' /etc/cloudflared/config-wemadeit.yml"
sudo launchctl kickstart -k system/com.cloudflare.cloudflared.wemadeit
sudo launchctl print system/com.cloudflare.cloudflared.wemadeit | head -n 20
```

# WeMadeIt developer helpers.
#
# `just run` starts the Go API server and the Next.js dev server in the background.
# PIDs + logs live under `.run/` so you can stop/status them later.

API_PORT := "8080"
WEB_PORT := "3000"
API_DATA_DIR := ".run/data"
API_CONFIG := ".run/config.json"

# Override on the command line, e.g.:
# `just API_PORT=8081 WEB_PORT=3001 run` (preferred)
# `just run 8081 3001` (also works)
run arg1="" arg2="":
    #!/usr/bin/env bash
    set -euo pipefail

    mkdir -p .run/bin .run/logs .run/pids
    go build -mod=mod -o .run/bin/wemadeit-api ./cmd/server

    port_in_use() {
      local port="$1"
      lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    }

    port_owner() {
      local port="$1"
      # Prints: "<cmd> <pid>" or "".
      lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1, $2}' || true
    }

    pick_free_port() {
      local start="$1"
      local end="$2"
      local p="$start"
      while [ "$p" -le "$end" ]; do
        if ! port_in_use "$p"; then
          echo "$p"
          return 0
        fi
        p=$((p + 1))
      done
      return 1
    }

    api_port="{{API_PORT}}"
    web_port="{{WEB_PORT}}"

    api_port_set="false"
    web_port_set="false"

    normalize_kv() {
      # If arg looks like KEY=VALUE, prints "KEY VALUE", else prints "".
      local arg="$1"
      if [[ "$arg" == *"="* ]]; then
        echo "${arg%%=*} ${arg#*=}"
      fi
    }

    is_number() {
      [[ "$1" =~ ^[0-9]+$ ]]
    }

    apply_arg() {
      local arg="$1"
      if [ -z "$arg" ]; then
        return 0
      fi

      kv="$(normalize_kv "$arg")"
      if [ -n "$kv" ]; then
        key="${kv%% *}"
        val="${kv#* }"
        case "$key" in
          API_PORT|api_port|api)
            api_port="$val"
            api_port_set="true"
            return 0
            ;;
          WEB_PORT|web_port|web)
            web_port="$val"
            web_port_set="true"
            return 0
            ;;
        esac
      fi

      if is_number "$arg"; then
        if [ "$api_port_set" = "false" ]; then
          api_port="$arg"
          api_port_set="true"
          return 0
        fi
        if [ "$web_port_set" = "false" ]; then
          web_port="$arg"
          web_port_set="true"
          return 0
        fi
        echo "Too many numeric args: '$arg'"
        exit 2
      fi

      echo "Unknown argument: '$arg'"
      echo "Accepted examples:"
      echo "  just run 8081 3001"
      echo "  just run API_PORT=8081 WEB_PORT=3001"
      echo "  just API_PORT=8081 WEB_PORT=3001 run"
      exit 2
    }

    apply_arg "{{arg1}}"
    apply_arg "{{arg2}}"

    if ! is_number "$api_port"; then
      echo "Invalid API_PORT: '$api_port' (expected a number)"
      exit 2
    fi
    if ! is_number "$web_port"; then
      echo "Invalid WEB_PORT: '$web_port' (expected a number)"
      exit 2
    fi

    bind_host="127.0.0.1"
    api_url="http://localhost:${api_port}"

    # If we already started an API previously, keep using it.
    if [ -f .run/pids/api.pid ] && kill -0 "$(cat .run/pids/api.pid)" 2>/dev/null; then
      echo "API already running (pid $(cat .run/pids/api.pid))"
      if [ -f .run/api.url ]; then
        api_url="$(cat .run/api.url)"
      fi
    else
      rm -f .run/pids/api.pid
      : > .run/logs/api.log

      if port_in_use "$api_port"; then
        owner="$(port_owner "$api_port")"

        if command -v curl >/dev/null 2>&1 && curl -fsS -m 1 "http://localhost:${api_port}/api/health" 2>/dev/null | grep -q '\"app\":\"wemadeit\"'; then
          echo "API port ${api_port} is in use (${owner:-unknown}) but /api/health identifies WeMadeIt; reusing"
        else
          echo "API port ${api_port} is in use (${owner:-unknown}); starting WeMadeIt API on a free port instead"
          api_port="$(pick_free_port "$((api_port + 1))" "$((api_port + 50))")"
          api_url="http://localhost:${api_port}"
          nohup ./.run/bin/wemadeit-api \
            --addr "${bind_host}:${api_port}" \
            --data "{{API_DATA_DIR}}" \
            --config "{{API_CONFIG}}" \
            > .run/logs/api.log 2>&1 & echo $! > .run/pids/api.pid

          sleep 0.2
          if ! kill -0 "$(cat .run/pids/api.pid)" 2>/dev/null; then
            echo "API failed to start. Tail of .run/logs/api.log:"
            tail -n 50 .run/logs/api.log || true
            rm -f .run/pids/api.pid
            exit 1
          fi
          echo "Started API (pid $(cat .run/pids/api.pid))"
        fi
      else
        nohup ./.run/bin/wemadeit-api \
          --addr "${bind_host}:${api_port}" \
          --data "{{API_DATA_DIR}}" \
          --config "{{API_CONFIG}}" \
          > .run/logs/api.log 2>&1 & echo $! > .run/pids/api.pid

        sleep 0.2
        if ! kill -0 "$(cat .run/pids/api.pid)" 2>/dev/null; then
          echo "API failed to start. Tail of .run/logs/api.log:"
          tail -n 50 .run/logs/api.log || true
          rm -f .run/pids/api.pid
          exit 1
        fi
        echo "Started API (pid $(cat .run/pids/api.pid))"
      fi
    fi

    echo "${api_url}" > .run/api.url

    if [ ! -d web/node_modules ]; then
      npm --prefix web install
    fi

    web_url="http://localhost:${web_port}"

    # If we already started a web server previously, keep using it.
    if [ -f .run/pids/web.pid ] && kill -0 "$(cat .run/pids/web.pid)" 2>/dev/null; then
      echo "Web already running (pid $(cat .run/pids/web.pid))"
      found="$(grep -Eo 'http://(localhost|127\\.0\\.0\\.1):[0-9]+' .run/logs/web.log | tail -n 1 || true)"
      if [ -n "${found}" ]; then
        web_url="${found}"
      elif [ -f .run/web.url ]; then
        web_url="$(cat .run/web.url)"
      fi
    else
      rm -f .run/pids/web.pid
      : > .run/logs/web.log

      # Pick the first free port at/above WEB_PORT so the printed URL is accurate.
      if port_in_use "$web_port"; then
        web_port="$(pick_free_port "$web_port" "$((web_port + 50))")"
      fi
      web_url="http://localhost:${web_port}"

      nohup env NEXT_PUBLIC_API_URL="${api_url}" \
        npm --prefix web run dev -- --port "${web_port}" --hostname "${bind_host}" \
        > .run/logs/web.log 2>&1 & echo $! > .run/pids/web.pid

      sleep 0.2
      if ! kill -0 "$(cat .run/pids/web.pid)" 2>/dev/null; then
        echo "Web failed to start. Tail of .run/logs/web.log:"
        tail -n 80 .run/logs/web.log || true
        rm -f .run/pids/web.pid
        exit 1
      fi

      # In case Next overrides the port anyway, extract the final URL from the log.
      for _ in $(seq 1 50); do
        found="$(grep -Eo 'http://(localhost|127\\.0\\.0\\.1):[0-9]+' .run/logs/web.log | tail -n 1 || true)"
        if [ -n "${found}" ]; then
          web_url="${found}"
          break
        fi
        sleep 0.1
      done

      echo "Started web (pid $(cat .run/pids/web.pid))"
    fi

    echo "${web_url}" > .run/web.url
    echo "API: ${api_url}"
    echo "Web: ${web_url}"

stop:
    @if [ -f .run/pids/web.pid ]; then kill "$(cat .run/pids/web.pid)" 2>/dev/null || true; rm -f .run/pids/web.pid; fi
    @if [ -f .run/pids/api.pid ]; then kill "$(cat .run/pids/api.pid)" 2>/dev/null || true; rm -f .run/pids/api.pid; fi
    @rm -f .run/api.url .run/web.url

restart arg1="" arg2="":
    #!/usr/bin/env bash
    set -euo pipefail
    just stop
    just run "{{arg1}}" "{{arg2}}"

status:
    #!/usr/bin/env bash
    set -euo pipefail

    api_url=""
    if [ -f .run/api.url ]; then
      api_url="$(cat .run/api.url)"
    fi

    web_url=""
    if [ -f .run/web.url ]; then
      web_url="$(cat .run/web.url)"
    fi

    if [ -f .run/pids/api.pid ] && kill -0 "$(cat .run/pids/api.pid)" 2>/dev/null; then
      echo "API running (pid $(cat .run/pids/api.pid))"
    elif [ -n "${api_url}" ]; then
      api_port="${api_url##*:}"
      if lsof -nP -iTCP:"${api_port}" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "API listening (port ${api_port}, not managed by pidfile)"
      else
        echo "API not running"
      fi
    else
      echo "API not running"
    fi

    if [ -f .run/pids/web.pid ] && kill -0 "$(cat .run/pids/web.pid)" 2>/dev/null; then
      echo "Web running (pid $(cat .run/pids/web.pid))"
    elif [ -n "${web_url}" ]; then
      web_port="${web_url##*:}"
      if lsof -nP -iTCP:"${web_port}" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Web listening (port ${web_port}, not managed by pidfile)"
      else
        echo "Web not running"
      fi
    else
      echo "Web not running"
    fi

    if [ -n "${api_url}" ]; then
      echo "API: ${api_url}"
    fi
    if [ -n "${web_url}" ]; then
      echo "Web: ${web_url}"
    fi

logs:
    @echo "api: .run/logs/api.log"
    @echo "web: .run/logs/web.log"

# Legacy Rails deploy (kept temporarily while refactor is in progress).
deploy-rails:
    cd legacy/rails && docker compose down
    cd legacy/rails && docker compose up --build -d

# Production (single-container: nginx + Go API).
prod-build:
    docker build -f Dockerfile.production -t wemadeit:production .

prod-up:
    docker compose -f docker-compose.production.yml up -d --build

prod-down:
    docker compose -f docker-compose.production.yml down

prod-logs:
    docker compose -f docker-compose.production.yml logs -f --tail=200

prod-shell:
    docker compose -f docker-compose.production.yml exec wemadeit sh

prod-restart:
    docker compose -f docker-compose.production.yml down
    docker compose -f docker-compose.production.yml up -d --build

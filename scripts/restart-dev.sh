#!/usr/bin/env bash
# Restart MDS frontend (4200) and backend (8080).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Stopping listeners on 4200 / 8080..."
for port in 4200 8080; do
  if pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
    if pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
done
pkill -f "ng serve" 2>/dev/null || true
pkill -f "uvicorn mds.main:app" 2>/dev/null || true
sleep 1

echo "Ensuring Postgres is up..."
docker compose up -d postgres

echo "Starting backend on 8080..."
(
  cd "$ROOT/mds-backend"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn mds.main:app --reload --host 127.0.0.1 --port 8080 --log-level info
) > /tmp/mds-backend.log 2>&1 &
echo "backend pid $!"

echo "Starting frontend on 4200..."
(
  cd "$ROOT/mds-ui"
  exec npm start -- --host 127.0.0.1 --port 4200
) > /tmp/mds-frontend.log 2>&1 &
echo "frontend pid $!"

echo "Waiting for health..."
for i in $(seq 1 90); do
  be=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/api/v1/health?skipMigrationCheck=true" 2>/dev/null || echo 000)
  fe=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:4200/" 2>/dev/null || echo 000)
  if [[ "$be" == "200" && "$fe" == "200" ]]; then
    echo "Ready: backend=$be frontend=$fe"
    echo "UI: http://127.0.0.1:4200"
    echo "Login: demo@lightdash.com / demo-password"
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for servers. Check /tmp/mds-backend.log and /tmp/mds-frontend.log"
exit 1

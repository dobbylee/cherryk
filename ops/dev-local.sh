#!/usr/bin/env bash

set -euo pipefail

project_root=$(cd "$(dirname "$0")/.." && pwd)
env_file=${CHERRYK_ENV_FILE:-$project_root/.env.local}
backend_pid=""

if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

export SPRING_PROFILES_ACTIVE="local"
export SPRING_BACKEND_ORIGIN="http://localhost:8080"
export CHERRYK_LOCAL_DATABASE_URL="${CHERRYK_LOCAL_DATABASE_URL:-jdbc:postgresql://localhost:5434/cherryk}"
export CHERRYK_LOCAL_DATABASE_USERNAME="${CHERRYK_LOCAL_DATABASE_USERNAME:-cherryk}"
export CHERRYK_LOCAL_DATABASE_PASSWORD="${CHERRYK_LOCAL_DATABASE_PASSWORD:-cherryk}"
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-local-development-client}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-local-development-secret}"
export ADMIN_EMAILS="${ADMIN_EMAILS:-local@cherryk.invalid}"
export SESSION_COOKIE_SECURE="false"
export CHERRYK_LOCAL_LOGIN_ENABLED="true"
export CHERRYK_LOCAL_LOGIN_EMAIL="${CHERRYK_LOCAL_LOGIN_EMAIL:-local@cherryk.invalid}"
export CHERRYK_LOCAL_LOGIN_DISPLAY_NAME="${CHERRYK_LOCAL_LOGIN_DISPLAY_NAME:-Local Learner}"

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid"
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to verify that local backend port 8080 is available." >&2
  exit 1
fi
if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Local backend port 8080 is already in use. Stop that process and retry." >&2
  exit 1
fi

compose_args=(docker compose)
if [[ -f "$env_file" ]]; then
  compose_args+=(--env-file "$env_file")
fi
compose_args+=(--profile backend)
"${compose_args[@]}" up -d --wait backend-postgres

"$project_root/backend/gradlew" -p "$project_root/backend" bootRun &
backend_pid=$!

backend_ready=false
for _ in {1..60}; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid"
    exit 1
  fi
  if curl --fail --silent http://localhost:8080/actuator/health >/dev/null; then
    backend_ready=true
    break
  fi
  sleep 0.5
done

if [[ "$backend_ready" != true ]]; then
  echo "Local Spring backend did not become healthy on port 8080." >&2
  exit 1
fi

cd "$project_root"
pnpm dev

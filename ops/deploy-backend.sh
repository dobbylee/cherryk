#!/usr/bin/env bash

set -euo pipefail

deploy_sha=${DEPLOY_SHA:?DEPLOY_SHA is required}
cherryk_root=${CHERRYK_ROOT:-/opt/cherryk}
compose_file=${CHERRYK_COMPOSE_FILE:-$cherryk_root/compose.yaml}
backup_dir=${CHERRYK_BACKUP_DIR:-$cherryk_root/operator/production}
lock_file=${CHERRYK_DEPLOY_LOCK_FILE:-/var/lock/cherryk-backend-deploy.lock}
health_attempts=${CHERRYK_HEALTH_ATTEMPTS:-60}
health_interval=${CHERRYK_HEALTH_INTERVAL:-1}
internal_health_url=${CHERRYK_INTERNAL_HEALTH_URL:-http://backend:8080/actuator/health}
external_health_url=${CHERRYK_EXTERNAL_HEALTH_URL:-https://api.cherryk.kr/actuator/health}
auth_url=${CHERRYK_AUTH_URL:-https://cherryk.kr/api/v1/auth/me}
recovery_log_dir=${CHERRYK_RECOVERY_LOG_DIR:-/tmp}

if [[ ! $deploy_sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid deploy SHA: $deploy_sha" >&2
  exit 1
fi

candidate_image="cherryk-backend:$deploy_sha"
short_sha=${deploy_sha:0:7}
backup_file=""
next_compose=""
cutover_started=0
failure_reason="Backend deployment failed"

exec 3>&1 4>&2

compose() {
  docker compose -f "$compose_file" "$@"
}

wait_for_internal_health() {
  local attempt
  local response

  for ((attempt = 1; attempt <= health_attempts; attempt += 1)); do
    if response=$(docker exec cherryk-nginx wget -qO- "$internal_health_url" 2>/dev/null) &&
      grep -q '"status":"UP"' <<<"$response"; then
      return 0
    fi
    if ((attempt < health_attempts)); then
      sleep "$health_interval"
    fi
  done

  echo "Backend did not become healthy" >&2
  return 1
}

verify_external_contracts() {
  local health_response
  local auth_response

  health_response=$(curl --fail --silent --show-error "$external_health_url")
  grep -q '"status":"UP"' <<<"$health_response"

  auth_response=$(curl --fail --silent --show-error "$auth_url")
  grep -Eq '^\{"user"[[:space:]]*:[[:space:]]*null\}$' <<<"$auth_response"
}

active_backend_image() {
  compose ps --format json backend | sed -nE 's/.*"Image":"([^"]+)".*/\1/p' | head -1
}

restore_previous_release() {
  local restored_compose

  echo "Restoring previous backend release" >&2
  restored_compose=$(mktemp "$cherryk_root/compose.rollback.XXXXXX")
  install -m "$(stat -c %a "$compose_file")" "$backup_file" "$restored_compose"
  chown --reference="$compose_file" "$restored_compose"
  mv "$restored_compose" "$compose_file"
  if ! compose up -d --no-deps backend; then
    return 1
  fi
  if ! wait_for_internal_health; then
    return 1
  fi
  echo "Previous backend release restored" >&2
}

handle_exit() {
  local status=$?
  local recovery_log=""
  local rollback_status=0

  trap - EXIT HUP INT TERM
  trap '' PIPE
  if ((status == 0)); then
    return
  fi
  set +e
  recovery_log=$(mktemp "$recovery_log_dir/cherryk-backend-deploy-recovery.XXXXXX" 2>/dev/null || true)
  if [[ -n $recovery_log ]]; then
    exec >>"$recovery_log" 2>&1
  fi
  echo "$failure_reason" >&2
  compose ps -a >&2 || true
  compose logs --tail=160 backend >&2 || true
  if [[ -n $next_compose ]]; then
    rm -f "$next_compose"
  fi

  if ((cutover_started == 1)) && [[ -n $backup_file ]]; then
    if ! restore_previous_release; then
      echo "Automatic backend rollback failed" >&2
      rollback_status=2
    fi
  fi

  if [[ -n $recovery_log ]]; then
    cat "$recovery_log" >&4 || true
  fi
  if ((rollback_status != 0)); then
    exit "$rollback_status"
  fi
  exit "$status"
}

fail_deploy() {
  failure_reason=$1
  exit 1
}

trap handle_exit EXIT
trap 'failure_reason="Backend deployment interrupted by HUP"; exit 129' HUP
trap 'failure_reason="Backend deployment interrupted by INT"; exit 130' INT
trap 'failure_reason="Backend deployment interrupted by TERM"; exit 143' TERM

exec 9>"$lock_file"
if ! flock -w 900 9; then
  echo "Another backend deployment is still running: $lock_file" >&2
  exit 1
fi

test -f "$compose_file"
install -d -m 700 "$backup_dir"
docker image inspect "$candidate_image" >/dev/null

current_image=$(
  sed -nE 's/^[[:space:]]*image:[[:space:]]*(cherryk-backend:[0-9a-f]{7,40})[[:space:]]*$/\1/p' "$compose_file"
)
if [[ -z $current_image || $current_image == *$'\n'* ]]; then
  echo "Expected exactly one commit-addressed cherryk-backend image in $compose_file" >&2
  exit 1
fi

if [[ $current_image == "$candidate_image" ]]; then
  active_image=$(active_backend_image)
  if [[ $active_image != "$candidate_image" ]]; then
    echo "Compose targets $candidate_image but the active backend uses ${active_image:-no image}" >&2
    exit 1
  fi
  if ! wait_for_internal_health || ! verify_external_contracts; then
    echo "Already-deployed backend failed its health checks" >&2
    exit 1
  fi
  echo "Backend $short_sha is already deployed and healthy"
  trap - EXIT HUP INT TERM
  exit 0
fi

docker image inspect "$current_image" >/dev/null
docker image tag "$current_image" cherryk-backend:rollback

backup_file=$(mktemp "$backup_dir/compose.pre-${short_sha}.XXXXXX.yaml")
install -m 600 "$compose_file" "$backup_file"

next_compose=$(mktemp "$cherryk_root/compose.next.XXXXXX")
sed -E \
  "s|^([[:space:]]*)image:[[:space:]]*${current_image}[[:space:]]*$|\\1image: ${candidate_image}|" \
  "$compose_file" > "$next_compose"
next_image=$(
  sed -nE 's/^[[:space:]]*image:[[:space:]]*(cherryk-backend:[0-9a-f]{7,40})[[:space:]]*$/\1/p' "$next_compose"
)
if [[ $next_image != "$candidate_image" ]]; then
  echo "Failed to write the candidate image to the backend Compose service" >&2
  exit 1
fi
chown --reference="$compose_file" "$next_compose"
chmod --reference="$compose_file" "$next_compose"
cutover_started=1
mv "$next_compose" "$compose_file"
next_compose=""

if ! compose up -d --no-deps backend; then
  fail_deploy "Backend replacement failed"
fi
if ! wait_for_internal_health; then
  fail_deploy "Backend health check failed"
fi
if ! verify_external_contracts; then
  fail_deploy "Backend public contract check failed"
fi

active_image=$(active_backend_image)
if [[ $active_image != "$candidate_image" ]]; then
  fail_deploy "Active backend image does not match $candidate_image"
fi

trap - EXIT HUP INT TERM
echo "Backend deployment healthy: $candidate_image"

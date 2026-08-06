#!/usr/bin/env bash

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
deploy_script="$repo_root/ops/deploy-backend.sh"
old_sha=1111111111111111111111111111111111111111
new_sha=2222222222222222222222222222222222222222

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

make_fixture() {
  fixture=$(mktemp -d)
  mkdir -p "$fixture/bin" "$fixture/root/operator/production"
  printf '%s\n' \
    'services:' \
    '  backend:' \
    "    image: cherryk-backend:$old_sha" \
    '  nginx:' \
    '    image: nginx:alpine' > "$fixture/root/compose.yaml"
  : > "$fixture/docker.log"

  cat > "$fixture/bin/flock" <<'FAKE_FLOCK'
#!/usr/bin/env bash
exit 0
FAKE_FLOCK

  cat > "$fixture/bin/chown" <<'FAKE_CHOWN'
#!/usr/bin/env bash
exit 0
FAKE_CHOWN

  cat > "$fixture/bin/chmod" <<'FAKE_CHMOD'
#!/usr/bin/env bash
exit 0
FAKE_CHMOD

  cat > "$fixture/bin/stat" <<'FAKE_STAT'
#!/usr/bin/env bash
printf '600\n'
FAKE_STAT

  cat > "$fixture/bin/mv" <<'FAKE_MV'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ ${FAKE_SIGNAL_BEFORE_MOVE:-0} == 1 && ${1:-} == *'/compose.next.'* ]]; then
  kill -TERM "$PPID"
  sleep 1
fi
exec /bin/mv "$@"
FAKE_MV

  cat > "$fixture/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"
case "${1:-} ${2:-}" in
  'image inspect'|'image tag')
    exit 0
    ;;
  'exec cherryk-nginx')
    if [[ ${FAKE_HEALTH:-up} == down ]] &&
      grep -q "image: cherryk-backend:$DEPLOY_SHA" "$CHERRYK_ROOT/compose.yaml"; then
      exit 1
    fi
    printf '{"status":"UP"}\n'
    exit 0
    ;;
esac
if [[ ${1:-} == compose ]]; then
  if [[ $* == *' ps --format json backend' ]]; then
    printf '{"Image":"%s"}\n' "${FAKE_ACTIVE_IMAGE:-cherryk-backend:$DEPLOY_SHA}"
    exit 0
  fi
  exit 0
fi
exit 1
FAKE_DOCKER

  cat > "$fixture/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -Eeuo pipefail
case "${*: -1}" in
  */actuator/health) printf '{"status":"UP"}\n' ;;
  */api/v1/auth/me) printf '{"user":null}\n' ;;
  *) exit 1 ;;
esac
FAKE_CURL

  chmod +x \
    "$fixture/bin/flock" \
    "$fixture/bin/chown" \
    "$fixture/bin/chmod" \
    "$fixture/bin/stat" \
    "$fixture/bin/mv" \
    "$fixture/bin/docker" \
    "$fixture/bin/curl"
}

run_deploy() {
  PATH="$fixture/bin:$PATH" \
    FAKE_DOCKER_LOG="$fixture/docker.log" \
    CHERRYK_ROOT="$fixture/root" \
    CHERRYK_DEPLOY_LOCK_FILE="$fixture/deploy.lock" \
    CHERRYK_RECOVERY_LOG_DIR="$fixture" \
    CHERRYK_HEALTH_ATTEMPTS=1 \
    CHERRYK_HEALTH_INTERVAL=0 \
    DEPLOY_SHA="$new_sha" \
    "$deploy_script"
}

make_fixture
trap 'rm -rf "$fixture"' EXIT
run_deploy
grep -q "image: cherryk-backend:$new_sha" "$fixture/root/compose.yaml" || fail "successful deploy did not update Compose"
[[ $(find "$fixture/root/operator/production" -name 'compose.pre-*.yaml' | wc -l) -eq 1 ]] || fail "successful deploy did not preserve one backup"
grep -q 'compose -f .* up -d --no-deps backend' "$fixture/docker.log" || fail "successful deploy did not replace only backend"
rm -rf "$fixture"
trap - EXIT

make_fixture
trap 'rm -rf "$fixture"' EXIT
if FAKE_HEALTH=down run_deploy; then
  fail "unhealthy deploy unexpectedly succeeded"
fi
grep -q "image: cherryk-backend:$old_sha" "$fixture/root/compose.yaml" || fail "unhealthy deploy did not restore Compose"
[[ $(grep -c 'compose -f .* up -d --no-deps backend' "$fixture/docker.log") -eq 2 ]] || fail "unhealthy deploy did not attempt rollback"
rm -rf "$fixture"
trap - EXIT

make_fixture
trap 'rm -rf "$fixture"' EXIT
sed -E "s/cherryk-backend:$old_sha/cherryk-backend:$new_sha/" "$fixture/root/compose.yaml" > "$fixture/root/compose.candidate.yaml"
/bin/mv "$fixture/root/compose.candidate.yaml" "$fixture/root/compose.yaml"
if FAKE_ACTIVE_IMAGE="cherryk-backend:$old_sha" run_deploy; then
  fail "Compose/runtime image mismatch unexpectedly succeeded"
fi
[[ ! -s "$fixture/docker.log" || $(grep -c 'compose -f .* up -d --no-deps backend' "$fixture/docker.log") -eq 0 ]] || fail "image mismatch attempted a replacement"
rm -rf "$fixture"
trap - EXIT

make_fixture
trap 'rm -rf "$fixture"' EXIT
set +e
FAKE_SIGNAL_BEFORE_MOVE=1 run_deploy 2>&1 | true
interrupted_status=${PIPESTATUS[0]}
set -e
[[ $interrupted_status -eq 143 ]] || fail "interrupted deploy returned $interrupted_status instead of 143"
grep -q "image: cherryk-backend:$old_sha" "$fixture/root/compose.yaml" || fail "interrupted deploy did not restore Compose"
[[ $(grep -c 'compose -f .* up -d --no-deps backend' "$fixture/docker.log") -eq 1 ]] || fail "interrupted deploy did not restore the previous container once"
recovery_log=$(find "$fixture" -name 'cherryk-backend-deploy-recovery.*' -type f)
[[ -n $recovery_log ]] || fail "interrupted deploy did not preserve a host-local recovery log"
grep -q 'Previous backend release restored' "$recovery_log" || fail "interrupted deploy did not finish rollback after its output channel closed"
rm -rf "$fixture"
trap - EXIT

make_fixture
trap 'rm -rf "$fixture"' EXIT
if PATH="$fixture/bin:$PATH" CHERRYK_ROOT="$fixture/root" DEPLOY_SHA=bad "$deploy_script"; then
  fail "invalid SHA unexpectedly succeeded"
fi
[[ ! -s "$fixture/docker.log" ]] || fail "invalid SHA reached Docker"
rm -rf "$fixture"
trap - EXIT

echo "deploy-backend safety tests passed"

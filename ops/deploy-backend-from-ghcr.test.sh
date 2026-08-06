#!/usr/bin/env bash

# Test doubles override functions that main invokes through dynamic dispatch.
# shellcheck disable=SC2329

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
wrapper_script="$repo_root/ops/deploy-backend-from-ghcr.sh"
target_sha=2222222222222222222222222222222222222222
other_sha=1111111111111111111111111111111111111111
valid_digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

fail_test() {
  echo "FAIL: $1" >&2
  exit 1
}

run_fixture() (
  # shellcheck source=ops/deploy-backend-from-ghcr.sh
  source "$wrapper_script"

  require_root() { :; }
  prepare_credentials() { :; }
  cleanup() { :; }
  login_to_registry() { printf 'login\n' >> "$fixture_log"; }
  pull_and_tag_image() { printf 'pull\n' >> "$fixture_log"; }
  run_operator_deploy() { printf 'deploy\n' >> "$fixture_log"; }
  remote_main_sha() {
    printf 'remote\n' >> "$remote_main_log"
    if [[ $(wc -l < "$remote_main_log") -eq 1 ]]; then
      printf '%s\n' "${first_remote_sha:-$target_sha}"
    else
      printf '%s\n' "${second_remote_sha:-$target_sha}"
    fi
  }

  main <<EOF
$target_sha
$valid_digest
dobbylee
ghs_validtoken
EOF
)

fixture_log=$(mktemp)
remote_main_log=$(mktemp)
trap 'rm -f "$fixture_log" "$remote_main_log"' EXIT
run_fixture
[[ $(sed -n '1p' "$fixture_log") == login ]] || fail_test "registry login did not run first"
[[ $(sed -n '2p' "$fixture_log") == pull ]] || fail_test "immutable image was not pulled second"
[[ $(sed -n '3p' "$fixture_log") == deploy ]] || fail_test "operator deployment did not run last"
[[ $(wc -l < "$fixture_log") -eq 3 ]] || fail_test "unexpected successful deployment calls"

: > "$fixture_log"
: > "$remote_main_log"
if first_remote_sha=$other_sha run_fixture; then
  fail_test "deployment continued when main never targeted the SHA"
fi
[[ ! -s $fixture_log ]] || fail_test "main mismatch reached registry or deployment"

: > "$fixture_log"
: > "$remote_main_log"
if second_remote_sha=$other_sha run_fixture; then
  fail_test "deployment continued after main advanced"
fi
grep -qx login "$fixture_log" || fail_test "main advance test did not log in"
grep -qx pull "$fixture_log" || fail_test "main advance test did not pull"
if grep -q deploy "$fixture_log"; then
  fail_test "main advance reached operator deployment"
fi

if (
  # shellcheck source=ops/deploy-backend-from-ghcr.sh
  source "$wrapper_script"
  deploy_sha=bad
  image_digest=$valid_digest
  registry_user=dobbylee
  github_token=ghs_validtoken
  validate_inputs
); then
  fail_test "invalid SHA was accepted"
fi

if (
  # shellcheck source=ops/deploy-backend-from-ghcr.sh
  source "$wrapper_script"
  deploy_sha=$target_sha
  image_digest=sha256:bad
  registry_user=dobbylee
  github_token=ghs_validtoken
  validate_inputs
); then
  fail_test "invalid digest was accepted"
fi

if (
  # shellcheck source=ops/deploy-backend-from-ghcr.sh
  source "$wrapper_script"
  deploy_sha=$target_sha
  image_digest=$valid_digest
  registry_user='bad user'
  github_token=ghs_validtoken
  validate_inputs
); then
  fail_test "invalid registry user was accepted"
fi

echo "GHCR deployment wrapper tests passed"

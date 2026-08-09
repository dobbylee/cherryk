#!/usr/bin/env bash

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
verify_script="$repo_root/ops/verify-postgresql-18-migration.sh"
source_service=cherryk_pg17_source
target_service=cherryk_pg18_target

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
printf '%s\n' \
  "[$source_service]" \
  'host=source.example.test' \
  'password=source_secret' \
  "[$target_service]" \
  'host=target.example.test' \
  'password=target_secret' >"$fixture/pg_service.conf"
chmod 600 "$fixture/pg_service.conf"

cat >"$fixture/psql" <<'FAKE_PSQL'
#!/usr/bin/env bash
set -Eeuo pipefail

input=$(cat)
invocation="$* $input"
is_target=0
[[ $invocation == *cherryk_pg18_target* ]] && is_target=1

if [[ $invocation == *source_secret* || $invocation == *target_secret* ]]; then
  echo "Database credential appeared in process arguments" >&2
  exit 1
fi

case "$invocation" in
  *'\conninfo'*)
    if ((is_target == 1)) && [[ ${FAKE_TARGET_POOLED:-0} == 1 ]]; then
      printf 'host=target-pooler.example.test\n'
    else
      printf 'host=direct.example.test\n'
    fi
    ;;
  *cherryk:server-major*)
    if ((is_target == 1)); then printf '18\n'; else printf '17\n'; fi
    ;;
  *cherryk:read-only-probe*) printf 'BEGIN\n1\nROLLBACK\n' ;;
  *cherryk:public-relation-count*) printf '%s\n' "${FAKE_TARGET_RELATION_COUNT:-0}" ;;
  *cherryk:snapshot-database*)
    if ((is_target == 1)) && [[ ${FAKE_LOCALE_MISMATCH:-0} == 1 ]]; then
      printf 'cherryk\tUTF8\ti\tC.UTF-8\tC.UTF-8\tko-KR\t\t153.1\n'
    else
      printf 'cherryk\tUTF8\tb\tC.UTF-8\tC.UTF-8\tC.UTF-8\t\t1\n'
    fi
    ;;
  *cherryk:snapshot-tables*) printf 'public.users\tr\tp\tf\tf\n' ;;
  *cherryk:snapshot-columns*) printf 'public.users\t1\tid\tbigint\tt\t\n' ;;
  *cherryk:snapshot-constraints*) printf 'public.users\tusers_pkey\tp\tPRIMARY KEY (id)\n' ;;
  *cherryk:snapshot-indexes*) printf 'public.users\tusers_pkey\tCREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)\n' ;;
  *cherryk:snapshot-sequences*) printf 'public.users_id_seq\t1\t1\t9223372036854775807\t1\tf\t1\n' ;;
  *cherryk:snapshot-sequence-state*)
    if ((is_target == 1)) && [[ ${FAKE_SEQUENCE_STATE_MISMATCH:-0} == 1 ]]; then
      printf 'public.users_id_seq\t2\tf\n'
    else
      printf 'public.users_id_seq\t2\tt\n'
    fi
    ;;
  *cherryk:snapshot-flyway*) printf '1\t1\tbaseline\tSQL\tB1.sql\t123\tt\n' ;;
  *cherryk:snapshot-data*)
    if ((is_target == 1)) && [[ ${FAKE_PARITY_MISMATCH:-0} == 1 ]]; then
      printf 'public.users\t1\tdifferent\n'
    else
      printf 'public.users\t1\tmatching\n'
    fi
    ;;
  *)
    echo "Unexpected psql invocation" >&2
    exit 1
    ;;
esac
FAKE_PSQL
chmod +x "$fixture/psql"

run_verify() {
  PGSERVICEFILE="$fixture/pg_service.conf" \
    SOURCE_DATABASE_SERVICE=$source_service \
    TARGET_DATABASE_SERVICE=$target_service \
    CHERRYK_PSQL_COMMAND="$fixture/psql" \
    "$verify_script" "$@"
}

run_verify preflight | grep -q 'migration preflight passed' ||
  fail "valid preflight did not pass"

if FAKE_TARGET_RELATION_COUNT=1 run_verify preflight >"$fixture/non-empty.out" 2>&1; then
  fail "non-empty target unexpectedly passed preflight"
fi
grep -q 'target is not empty' "$fixture/non-empty.out" ||
  fail "non-empty target failure was not explained"

run_verify parity | grep -q 'migration parity passed' ||
  fail "matching databases did not pass parity"

if FAKE_PARITY_MISMATCH=1 run_verify parity >"$fixture/mismatch.out" 2>&1; then
  fail "data mismatch unexpectedly passed parity"
fi
grep -q 'migration parity failed' "$fixture/mismatch.out" ||
  fail "parity mismatch failure was not explained"
if grep -q 'source_secret\|target_secret' "$fixture/mismatch.out"; then
  fail "parity failure exposed a database credential"
fi

if FAKE_SEQUENCE_STATE_MISMATCH=1 run_verify parity >"$fixture/sequence.out" 2>&1; then
  fail "sequence is_called mismatch unexpectedly passed parity"
fi
grep -q 'migration parity failed' "$fixture/sequence.out" ||
  fail "sequence state mismatch failure was not explained"

if FAKE_LOCALE_MISMATCH=1 run_verify parity >"$fixture/locale.out" 2>&1; then
  fail "database locale mismatch unexpectedly passed parity"
fi
grep -q 'migration parity failed' "$fixture/locale.out" ||
  fail "database locale mismatch failure was not explained"

if FAKE_TARGET_POOLED=1 run_verify preflight >"$fixture/pooler.out" 2>&1; then
  fail "pooled target unexpectedly passed preflight"
fi
grep -q 'direct, unpooled endpoint' "$fixture/pooler.out" ||
  fail "pooled target failure was not explained"

echo "PostgreSQL 18 migration verifier tests passed"

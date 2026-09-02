#!/usr/bin/env bash

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
backup_script="$repo_root/ops/backup-postgres.sh"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/backups"

cat > "$fixture/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail

case "${1:-}" in
  exec)
    printf 'verified backup payload\n'
    ;;
  run)
    if [[ ${FAKE_VALIDATION_FAIL:-0} == 1 ]]; then
      exit 1
    fi
    ;;
  *)
    exit 1
    ;;
esac
FAKE_DOCKER
chmod +x "$fixture/bin/docker"

run_backup() {
  local selected_backup_dir=${1:-"$fixture/backups"}

  PATH="$fixture/bin:$PATH" \
    CHERRYK_POSTGRES_BACKUP_DIR="$selected_backup_dir" \
    CHERRYK_POSTGRES_CONTAINER=cherryk-postgres \
    "$backup_script"
}

run_backup
backup_file=$(find "$fixture/backups" -maxdepth 1 -type f -name 'cherryk-*.dump')
[[ -n $backup_file ]] || fail "verified backup was not retained"
backup_mode=$(stat -c '%a' "$backup_file" 2>/dev/null || stat -f '%Lp' "$backup_file")
[[ $backup_mode == 600 ]] || fail "backup mode is not 600"
grep -qx 'verified backup payload' "$backup_file" || fail "backup payload was not written"

old_backup="$fixture/backups/cherryk-20000101T000000Z.dump"
touch -t 200001010000 "$old_backup"
if date -v-7d '+%Y%m%d%H%M.%S' >/dev/null 2>&1; then
  just_over_seven_days=$(date -v-7d -v-1S '+%Y%m%d%H%M.%S')
else
  just_over_seven_days=$(date --date='7 days ago - 1 second' '+%Y%m%d%H%M.%S')
fi
seven_day_backup="$fixture/backups/cherryk-seven-days-old.dump"
touch -t "$just_over_seven_days" "$seven_day_backup"
run_backup
[[ ! -e $old_backup ]] || fail "expired backup was not pruned"
[[ ! -e $seven_day_backup ]] || fail "backup older than seven days was not pruned"
if find "$fixture/backups" -maxdepth 1 -type f -name '*XXXXXX*' | grep -q .; then
  fail "backup collision suffix was not expanded"
fi

if FAKE_VALIDATION_FAIL=1 run_backup; then
  fail "unverified backup unexpectedly succeeded"
fi
if find "$fixture/backups" -maxdepth 1 -type f -name '.cherryk-postgres.*.dump' | grep -q .; then
  fail "failed validation left a temporary backup"
fi

if run_backup "$fixture/backups/.."; then
  fail "parent-resolving backup directory was accepted"
fi

echo "PostgreSQL backup safety tests passed"

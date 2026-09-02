#!/usr/bin/env bash

set -Eeuo pipefail

readonly postgres_image='postgres:18.6'
backup_dir=${CHERRYK_POSTGRES_BACKUP_DIR:-/opt/cherryk/backups/postgres}
postgres_container=${CHERRYK_POSTGRES_CONTAINER:-cherryk-postgres}
retention_days=${CHERRYK_POSTGRES_BACKUP_RETENTION_DAYS:-7}

if [[ $backup_dir != /* || $backup_dir == / || $backup_dir == *"//"* || $backup_dir == *"/../"* || $backup_dir == */.. ]]; then
  echo "Invalid PostgreSQL backup directory" >&2
  exit 1
fi
if [[ ! $postgres_container =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
  echo "Invalid PostgreSQL container name" >&2
  exit 1
fi
if [[ ! $retention_days =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid PostgreSQL backup retention" >&2
  exit 1
fi

install -d -m 700 "$backup_dir"
backup_dir=$(cd "$backup_dir" && pwd -P)
if [[ $backup_dir == / ]]; then
  echo "Invalid PostgreSQL backup directory" >&2
  exit 1
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/cherryk-$timestamp.dump"
if [[ -e $backup_file ]]; then
  collision_stub=$(mktemp "$backup_dir/.cherryk-postgres-collision.XXXXXX")
  collision_suffix=${collision_stub##*.}
  backup_file="$backup_dir/cherryk-$timestamp.$collision_suffix.dump"
  rm -f "$collision_stub"
fi

temporary_stub=$(mktemp "$backup_dir/.cherryk-postgres.XXXXXX")
temporary_file="$temporary_stub.dump"
mv "$temporary_stub" "$temporary_file"
cleanup() {
  rm -f "$temporary_file"
}
trap cleanup EXIT

docker exec "$postgres_container" sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$temporary_file"

docker run --rm --user 0:0 \
  -v "$backup_dir":/backups:ro \
  "$postgres_image" \
  pg_restore --list "/backups/$(basename "$temporary_file")" >/dev/null

chmod 600 "$temporary_file"
mv "$temporary_file" "$backup_file"
trap - EXIT

prune_after_days=$((retention_days - 1))
find "$backup_dir" -maxdepth 1 -type f -name 'cherryk-*.dump' -mtime "+$prune_after_days" -delete

printf 'PostgreSQL backup verified: %s\n' "$backup_file"

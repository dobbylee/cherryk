#!/usr/bin/env bash

set -Eeuo pipefail

mode=${1:-}
source_database_service=${SOURCE_DATABASE_SERVICE:-}
target_database_service=${TARGET_DATABASE_SERVICE:-}
psql_command=${CHERRYK_PSQL_COMMAND:-psql}

fail() {
  echo "$1" >&2
  exit 1
}

usage() {
  cat >&2 <<'USAGE'
Usage: PGSERVICEFILE=/protected/path/pg_service.conf \
  SOURCE_DATABASE_SERVICE=... TARGET_DATABASE_SERVICE=... \
  ops/verify-postgresql-18-migration.sh preflight|parity

Both libpq services must use direct, unpooled PostgreSQL endpoints. The verifier
is read-only: preflight requires an empty PostgreSQL 18 target, while parity
compares the restored target with the PostgreSQL 17 source.
USAGE
}

validate_service() {
  local label=$1
  local service=$2

  [[ -n $service ]] || fail "$label is required"
  [[ $service =~ ^[A-Za-z0-9_.-]+$ ]] || fail "$label is invalid"
}

run_query() {
  local service=$1
  local sql=$2

  PGAPPNAME=cherryk-postgresql-18-verifier \
    "$psql_command" \
    --dbname="service=$service" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --tuples-only \
    --no-align \
    --field-separator=$'\t' \
    --command="$sql"
}

run_sql_file() {
  local service=$1

  PGAPPNAME=cherryk-postgresql-18-verifier \
    "$psql_command" \
    --dbname="service=$service" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --tuples-only \
    --no-align \
    --field-separator=$'\t' \
    --file=-
}

server_major() {
  run_query "$1" \
    "/* cherryk:server-major */ SELECT current_setting('server_version_num')::integer / 10000;"
}

verify_direct_connection() {
  local service=$1
  local connection_info

  connection_info=$(
    PGAPPNAME=cherryk-postgresql-18-verifier \
      "$psql_command" \
      --dbname="service=$service" \
      --no-psqlrc \
      --command='\conninfo'
  )
  [[ $connection_info != *-pooler.* ]] ||
    fail "$service must use a direct, unpooled endpoint"
}

verify_read_only_connection() {
  run_query "$1" \
    "/* cherryk:read-only-probe */ BEGIN READ ONLY; SELECT 1; ROLLBACK;" >/dev/null
}

public_relation_count() {
  run_query "$1" \
    "/* cherryk:public-relation-count */
     SELECT count(*)
     FROM pg_catalog.pg_class AS c
     JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');"
}

write_snapshot() {
  local url=$1
  local output_file=$2

  {
    echo '[database]'
    run_query "$url" \
      "/* cherryk:snapshot-database */
       SELECT current_database(),
              pg_encoding_to_char(encoding),
              datlocprovider,
              datcollate,
              datctype,
              COALESCE(datlocale, ''),
              COALESCE(daticurules, ''),
              COALESCE(datcollversion, '')
       FROM pg_catalog.pg_database
       WHERE datname = current_database();"

    echo '[tables]'
    run_query "$url" \
      "/* cherryk:snapshot-tables */
       SELECT n.nspname || '.' || c.relname,
              c.relkind,
              c.relpersistence,
              c.relrowsecurity,
              c.relforcerowsecurity
       FROM pg_catalog.pg_class AS c
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       ORDER BY 1;"

    echo '[columns]'
    run_query "$url" \
      "/* cherryk:snapshot-columns */
       SELECT n.nspname || '.' || c.relname,
              row_number() OVER (
                PARTITION BY c.oid
                ORDER BY a.attnum
              ) AS ordinal_position,
              a.attname,
              pg_catalog.format_type(a.atttypid, a.atttypmod),
              a.attnotnull,
              COALESCE(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_catalog.pg_attribute AS a
       JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       LEFT JOIN pg_catalog.pg_attrdef AS d
         ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY 1, a.attnum;"

    echo '[constraints]'
    run_query "$url" \
      "/* cherryk:snapshot-constraints */
       SELECT n.nspname || '.' || c.relname,
              con.conname,
              con.contype,
              pg_catalog.pg_get_constraintdef(con.oid, true)
       FROM pg_catalog.pg_constraint AS con
       JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND con.contype <> 'n'
       ORDER BY 1, con.conname;"

    echo '[indexes]'
    run_query "$url" \
      "/* cherryk:snapshot-indexes */
       SELECT schemaname || '.' || tablename,
              indexname,
              indexdef
       FROM pg_catalog.pg_indexes
       WHERE schemaname = 'public'
       ORDER BY 1, indexname;"

    echo '[sequences]'
    run_query "$url" \
      "/* cherryk:snapshot-sequences */
       SELECT schemaname || '.' || sequencename,
              start_value,
              min_value,
              max_value,
              increment_by,
              cycle,
              cache_size
       FROM pg_catalog.pg_sequences
       WHERE schemaname = 'public'
       ORDER BY 1;"

    echo '[sequence-state]'
    run_sql_file "$url" <<'SQL'
/* cherryk:snapshot-sequence-state */
SELECT format(
  'SELECT %L, last_value, is_called FROM %I.%I;',
  schemaname || '.' || sequencename,
  schemaname,
  sequencename
)
FROM pg_catalog.pg_sequences
WHERE schemaname = 'public'
ORDER BY schemaname, sequencename
\gexec
SQL

    echo '[flyway]'
    run_query "$url" \
      "/* cherryk:snapshot-flyway */
       SELECT installed_rank,
              COALESCE(version, ''),
              description,
              type,
              script,
              COALESCE(checksum::text, ''),
              success
       FROM public.flyway_schema_history
       ORDER BY installed_rank;"

    echo '[data]'
    run_sql_file "$url" <<'SQL'
/* cherryk:snapshot-data */
SELECT format(
  'SELECT %L, count(*)::text, md5(COALESCE(string_agg(row_json, E''\n'' ORDER BY row_json), '''')) FROM (SELECT to_jsonb(t)::text AS row_json FROM %I.%I AS t) AS rows;',
  n.nspname || '.' || c.relname,
  n.nspname,
  c.relname
)
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname
\gexec
SQL
  } >"$output_file"
}

case "$mode" in
  preflight | parity) ;;
  *)
    usage
    exit 2
    ;;
esac

[[ -n ${PGSERVICEFILE:-} ]] || fail "PGSERVICEFILE is required"
[[ -f $PGSERVICEFILE && -r $PGSERVICEFILE ]] ||
  fail "PGSERVICEFILE must be a readable file"
service_file_mode=$(stat -c '%a' "$PGSERVICEFILE" 2>/dev/null || stat -f '%Lp' "$PGSERVICEFILE")
[[ $service_file_mode == 600 || $service_file_mode == 400 ]] ||
  fail "PGSERVICEFILE permissions must be 600 or 400"
validate_service SOURCE_DATABASE_SERVICE "$source_database_service"
validate_service TARGET_DATABASE_SERVICE "$target_database_service"
[[ $source_database_service != "$target_database_service" ]] ||
  fail "Source and target database services must be different"
command -v "$psql_command" >/dev/null 2>&1 || fail "psql is required"

verify_direct_connection "$source_database_service"
verify_direct_connection "$target_database_service"
source_major=$(server_major "$source_database_service")
target_major=$(server_major "$target_database_service")
[[ $source_major == 17 ]] || fail "Expected PostgreSQL 17 source, got $source_major"
[[ $target_major == 18 ]] || fail "Expected PostgreSQL 18 target, got $target_major"

verify_read_only_connection "$source_database_service"
verify_read_only_connection "$target_database_service"

if [[ $mode == preflight ]]; then
  target_relations=$(public_relation_count "$target_database_service")
  [[ $target_relations == 0 ]] ||
    fail "PostgreSQL 18 target is not empty: found $target_relations public relations"
  echo "PostgreSQL 17 to 18 migration preflight passed"
  exit 0
fi

snapshot_dir=$(mktemp -d)
trap 'rm -rf "$snapshot_dir"' EXIT
source_snapshot="$snapshot_dir/source.snapshot"
target_snapshot="$snapshot_dir/target.snapshot"
write_snapshot "$source_database_service" "$source_snapshot"
write_snapshot "$target_database_service" "$target_snapshot"

if ! diff -u "$source_snapshot" "$target_snapshot"; then
  fail "PostgreSQL 17 to 18 migration parity failed"
fi

echo "PostgreSQL 17 to 18 migration parity passed"

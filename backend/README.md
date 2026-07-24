# CherryK Spring backend

## Existing-schema preflight

Before baselining an existing Neon branch, run the read-only schema and quiz-data check:

```bash
SCHEMA_PREFLIGHT_DATABASE_URL=jdbc:postgresql://host/database \
SCHEMA_PREFLIGHT_DATABASE_USERNAME=user \
SCHEMA_PREFLIGHT_DATABASE_PASSWORD=password \
./backend/gradlew -p backend schemaPreflight
```

The command does not start Spring or Flyway. It opens a read-only transaction, compares the database with the frozen final Drizzle snapshot, checks the data required by the planned quiz constraints, and rolls the transaction back.

Do not run Flyway baseline unless this command succeeds against the intended database.

## Existing database adoption

For an existing Drizzle-managed database:

1. Create or confirm a restorable database backup.
2. Run `schemaPreflight` against the exact target database.
3. Explicitly baseline Flyway at version `1` with description `Drizzle schema baseline`.
4. Start the Spring migration process so Flyway applies `V2__quiz_lifecycle_constraints.sql`.
5. Verify the preserved correction, tag, quiz, choice, and attempt row counts.

Never enable `baseline-on-migrate` for this transition. The automated
`ExistingDatabaseAdoptionTest` reproduces the preflight, explicit version-1 baseline,
V2 migration, and data-preservation sequence against PostgreSQL 18.

The repository provides a guarded one-time command that performs steps 2 through 4 and
refuses databases that already have Flyway history:

```bash
FLYWAY_ADOPTION_CONFIRM=BASELINE_DRIZZLE_AND_MIGRATE_TO_V2 \
FLYWAY_ADOPTION_EXPECTED_HOST=host \
SCHEMA_PREFLIGHT_DATABASE_URL=jdbc:postgresql://host/database \
SCHEMA_PREFLIGHT_DATABASE_USERNAME=user \
SCHEMA_PREFLIGHT_DATABASE_PASSWORD=password \
./backend/gradlew -p backend adoptExistingDatabase
```

The command is pinned to target version `2`; later migrations are never applied by this
initial-adoption command.

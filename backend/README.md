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

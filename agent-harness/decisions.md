# Project Decisions

## Current Stack

- Frontend: Next.js App Router with TypeScript, deployed on Vercel.
- Current backend during migration: Next.js API routes with TypeScript.
- Target backend: Kotlin with Spring Boot and Spring MVC.
- Production database: Neon managed PostgreSQL.
- Local database: Docker Compose with the official `postgres:18` image.
- Current persistence layer during migration: Drizzle ORM.
- Target schema owner: Flyway.
- Target persistence split: Spring Data JPA for aggregate writes and simple CRUD; JdbcTemplate or native SQL for recommendation, progress, and other query-heavy read models.
- Hibernate validates mappings against the managed schema with `ddl-auto=validate`; it does not create or update Production schema.
- Adopt the existing Neon schema into Flyway only after it matches the verified Drizzle-derived baseline. Run the initial baseline explicitly and keep automatic `baselineOnMigrate` disabled.
- Package/build tools: pnpm for the frontend and the Gradle wrapper for the Spring backend.
- Target backend deployment: a Docker container on one cloud VM. Keep production PostgreSQL on Neon instead of adding a database container to that VM.

## Authentication

- Move authentication to Spring Security with Google OIDC.
- Store server-side sessions in PostgreSQL with Spring Session JDBC.
- Do not introduce JWT or Redis for the initial Spring migration.
- A one-time re-login at cutover is acceptable; existing Better Auth sessions are not migrated.
- Keep admin authorization as a Google account session plus the `ADMIN_EMAILS` allowlist until role management is separately justified.

## AI Runtime

- Keep OpenAI behind language-model provider boundaries for text correction and quiz draft generation.
- Move image text extraction to a separate CLOVA General OCR V2 provider.
- Do not store OCR image originals or include image bytes or extracted text in ordinary logs.
- Preserve editable OCR output: OCR produces a draft that the user can correct before requesting language correction.

## Quiz Domain

- Keep quiz behavior in one bounded `quiz` module.
- Model `Quiz` as the aggregate root that owns exactly four `QuizChoice` entities.
- Model `QuizAttempt` as a separate append-only aggregate referencing quiz and choice identifiers.
- Use the lifecycle `DRAFT -> APPROVED -> RETIRED`.
- Approved quizzes are immutable. A correction creates a new draft/version and retires the old quiz after approval.
- Keep admin command DTOs and user-facing read DTOs separate.
- Preserve the existing content-fingerprint behavior with cross-language golden tests before changing ownership from TypeScript to Kotlin.

## Deferred Decisions

- Exact JDK, Spring Boot, and Kotlin versions are selected together at backend bootstrap and recorded here before implementation.
- The cloud VM provider, size, public hostname, and TLS termination are selected before Preview deployment.
- Redis is added only when measured cache, distributed rate-limit, or job-coordination needs justify it.
- Self-hosting PostgreSQL on the backend VM and JWT-based authentication are not part of the initial migration.

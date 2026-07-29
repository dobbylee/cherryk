# Project Decisions

This file records durable choices that are not safely inferred from the current
code alone. Exact dependency versions live in manifests.

## Architecture

- Keep the Next.js frontend on Vercel and move backend behavior to Kotlin/Spring MVC in one Docker container on a cloud VM.
- Keep Production PostgreSQL on Neon; do not colocate it on the backend VM.
- Run Spring Preview on an OCI Ampere A1 VM behind a Dockerized Nginx TLS proxy at `api-preview.cherryk.kr`; manage the domain with Vercel DNS and certificates with host Certbot.
- Keep Spring and Neon in nearby APAC regions. With the backend in OCI Chuncheon and no Neon Seoul region, use Neon AWS Singapore instead of the legacy US East project.
- Preserve `/api/v1` contracts through the migration. Do not use dual writes.
- Do not add Redis, JWT, WebFlux, coroutines, or microservices without a measured need and a new decision.

## Authentication

- Use Spring Security, Google OIDC, and PostgreSQL-backed Spring Session.
- Link legacy Google users only by verified Google issuer/subject and the matching legacy provider/account identifier; never merge by email alone.
- Preserve application users and data, but require one re-login instead of migrating Better Auth sessions.
- Keep admin authorization as verified Google identity plus `ADMIN_EMAILS` until role management is justified.

## Persistence and Cutover

- Flyway exclusively owns target schema changes. Baseline an existing Neon database only after equivalence checks; never enable automatic Production baselining.
- Use JPA for aggregate writes/simple CRUD and JDBC/native SQL for query-heavy read models. Hibernate only validates mappings.
- Use PostgreSQL BIGINT identity keys for target entities and opaque string IDs in JSON. Composite domain keys and Spring Session identifiers are exceptions.
- V4 is incompatible with the UUID-based Next backend. Apply it only after writes stop and a Neon restore point exists; rollback must restore both the database and application route.
- Neon projects do not move regions in place. Relocate Preview and Production separately with a write freeze, recoverable dump/restore, parity checks, and an environment rollback to the retained source project.
- Treat each regional target as authoritative only when its verification and route/environment rollback rehearsal finish. After real target writes resume, an endpoint or environment-file swap is not a valid rollback without reverse migration or reconciliation.
- Treat `neon_auth` as Neon-managed platform state rather than CherryK application data. Regional archives exclude that schema because CherryK authentication is owned by Spring OIDC.

## AI, OCR, and Privacy

- Keep OpenAI behind separate correction and quiz-draft provider interfaces.
- Use CLOVA General OCR V2 only for OCR, behind its own provider interface.
- OCR output remains an editable draft. Never persist image originals or include image bytes/extracted text in ordinary logs.
- Speech transcription may produce the same editable correction draft, but pronunciation assessment remains a separate domain and provider boundary.
- Never persist voice recordings. Select speech providers only after representative Korean learner evaluation.
- Meter provider usage by feature and units: requests for correction/OCR and audio duration for speech. Reserve quota before a provider call, then commit processed usage or release failed calls.

## Quiz Domain

- `Quiz` owns exactly four choices; `QuizAttempt` is a separate append-only aggregate.
- Only approved quizzes are user-visible. Approved content is immutable; changes use a new draft and retire the previous quiz after approval.
- Preserve current fingerprint and personalized recommendation behavior during migration.
- Keep admin command DTOs separate from user read DTOs.

## Deferred

- Confirm Vercel rewrite cookie/forwarded-header behavior in Preview before locking the routing design.
- Consider Redis, self-hosted PostgreSQL, JWT, or role tables only after current migration needs justify them.

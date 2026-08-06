# Project Decisions

This file records durable choices that are not safely inferred from the current
code alone. Exact dependency versions live in manifests.

## Architecture

- Keep the Next.js frontend on Vercel and move backend behavior to Kotlin/Spring MVC in one Docker container on a cloud VM.
- Keep Production PostgreSQL on Neon; do not colocate it on the backend VM.
- Expose Spring Production at `api.cherryk.kr`. After cutover, keep one Spring
  application container configured for Production behind the existing Nginx proxy;
  do not operate a second permanent Preview service. Never route Preview traffic
  to the Production container or database. Future backend Preview verification
  must use a separately configured temporary container and database.
- While CherryK has one developer, use only the local checkout, `preview`, and
  `main`: push reviewed commits directly to `preview`, run the full CI gate there,
  verify Preview, and fast-forward the same green commit to `main`. Do not require
  feature branches or pull requests for this stage.
- Keep Vercel Git deployment as the frontend CD path. A successful `main` CI run
  publishes the commit-addressed ARM64 backend image to GHCR. A repository-scoped,
  Production-only self-hosted runner on OCI may invoke only the root-owned deployment
  wrapper, which pulls the immutable digest, serializes Production changes, preserves
  the previous image and Compose file, and rolls the application container back when
  health or public contract checks fail. Do not run pull-request or general CI work
  on the Production runner, and restrict the GitHub `Production` environment to
  `main`.
- Keep `Verify` as the required `main` check. When the exact SHA already has a
  successful push-triggered `preview` CI run, the `main` check reuses that result
  instead of repeating the full gate. A direct `main` SHA, manual run, or failed API
  lookup runs the complete gate on `main`.
- Keep Spring and Neon in nearby APAC regions. With the backend in OCI Chuncheon and no Neon Seoul region, use Neon AWS Singapore instead of the legacy US East project.
- Preserve `/api/v1` contracts through the migration. Do not use dual writes.
- Do not add Redis, JWT, WebFlux, coroutines, or microservices without a measured need and a new decision.

## Authentication

- Use Spring Security, Google OIDC, and PostgreSQL-backed Spring Session.
- Link legacy Google users only by verified Google issuer/subject and the matching legacy provider/account identifier; never merge by email alone.
- Google provider/account subjects were backfilled into `user_identities` with
  a guarded Flyway migration before the legacy auth runtime was retired.
  Runtime identity resolution uses `user_identities` only and never merges by
  email alone.
- The legacy-auth rollback retention period is complete. Remove `accounts`,
  `auth_sessions`, and `verifications` only through a guarded forward Flyway
  migration that fails when a legacy provider is unsupported or a Google
  account is missing its exact `user_identities` mapping. Preserve the earlier
  migrations so empty databases still replay the historical transition.
- Preserve application users and data; the migration intentionally required one re-login instead of migrating Better Auth sessions.
- Keep admin authorization as verified Google identity plus `ADMIN_EMAILS` until role management is justified.

## Persistence and Cutover

- Flyway exclusively owns target schema changes. Baseline an existing Neon database only after equivalence checks; never enable automatic Production baselining.
- Use JPA for aggregate writes/simple CRUD and JDBC/native SQL for query-heavy read models. Hibernate only validates mappings.
- Use PostgreSQL BIGINT identity keys for target entities and opaque string IDs in JSON. Composite domain keys and Spring Session identifiers are exceptions.
- V4 is incompatible with the UUID-based Next backend. Apply it only after writes stop and a Neon restore point exists; rollback must restore both the database and application route.
- Neon projects do not move regions in place. Relocate Preview and Production separately with a write freeze, recoverable dump/restore, parity checks, and an environment rollback to the retained source project.
- Treat each regional target as authoritative only when its verification and route/environment rollback rehearsal finish. After real target writes resume, an endpoint or environment-file swap is not a valid rollback without reverse migration or reconciliation.
- Clean up expired external rollback resources only after resolving their exact
  identifiers with read-only inventory. Keep the current deployment's immediate
  previous image and protected Compose backup until its health and public smoke
  checks pass; do not remove the automatic rollback mechanism itself.
- Treat `neon_auth` as Neon-managed platform state rather than CherryK application data. Regional archives exclude that schema because CherryK authentication is owned by Spring OIDC.
- During a Production migration window, enable the same `write-frozen` maintenance
  mode at both the Vercel API boundary and the Spring security boundary. Block the
  complete public `/api/v1` and `/api/auth` trees because OAuth callbacks and
  authenticated reads can update identity or session state on GET. Operator
  validation requires the short-lived HttpOnly bypass cookie or its secret header;
  a missing or invalid bypass secret never reopens public writes.

## AI, OCR, and Privacy

- Keep OpenAI behind separate correction and quiz-draft provider interfaces.
- Use CLOVA General OCR V2 only for OCR, behind its own provider interface.
- Use CLOVA for initial Production operation. Defer the Google Cloud Vision
  comparison until measured OCR quality or cost justifies reopening it; the
  comparison is not a Production cutover gate.
- OCR output remains an editable draft. Never persist image originals or include image bytes/extracted text in ordinary logs.
- Speech transcription may produce the same editable correction draft, but pronunciation assessment remains a separate domain and provider boundary.
- Never persist voice recordings. Select speech providers only after representative Korean learner evaluation.
- Meter provider usage by feature and units: requests for correction/OCR and audio duration for speech. Reserve quota before a provider call, then commit processed usage or release failed calls.

## Quiz Domain

- `Quiz` owns exactly four choices; `QuizAttempt` is a separate append-only aggregate.
- Model grammar and vocabulary as explicit quiz types. Vocabulary quizzes use an
  English definition as the question, exactly four Korean word choices, and the
  existing `word_choice` tag for compatibility with tag-based quiz history.
- `questionEn` owns the learner instruction. For grammar tags, `sentenceKo`
  contains only exercise content; generated Korean instruction prefixes are
  removed before persistence. `unnatural` is the explicit exception because it
  has no separate exercise stem and may repeat the instruction in Korean.
- Keep exact content fingerprints and learning-target identity as separate
  duplicate guards. Vocabulary identity is the normalized correct Korean word;
  `sentence_order` and `unnatural` identity is the normalized correct choice;
  other grammar identity is the normalized exercise plus correct choice, scoped
  by quiz type and tag. Ordinary generation and edits reserve append-only target
  history even if a draft is later rejected or a quiz retired. An unchanged
  target in an explicit revision remains allowed.
- Select vocabulary answers from the database-owned, difficulty-tiered target
  catalog before calling OpenAI. The model writes the definition, distractors,
  and explanation for those exact targets; it does not choose the target words.
  Never send the accumulated target history to the model. Grammar retries may
  include only the current bounded batch exclusions, while PostgreSQL remains
  authoritative for full-history duplicate rejection.
- Only approved quizzes are user-visible. Approved content is immutable; changes use a new draft and retire the previous quiz after approval.
- Preserve current fingerprint and personalized recommendation behavior during migration.
- Keep admin command DTOs separate from user read DTOs.

## Deferred

- Consider Redis, self-hosted PostgreSQL, JWT, or role tables only after current migration needs justify them.

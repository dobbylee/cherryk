# Project Decisions

This file contains current choices that are not safely inferred from code. Exact
versions and implemented structure belong in manifests and code; completed rollout
evidence belongs under `local/`.

## Architecture and Delivery

- Host the Next.js frontend on Vercel and backend behavior in one Kotlin/Spring MVC
  container on OCI. Keep Production PostgreSQL on Neon in AWS Singapore, near OCI
  Chuncheon.
- Expose Production Spring at `api.cherryk.kr` behind Nginx. Do not operate a
  permanent Preview backend or route Preview to Production; backend Preview uses a
  temporary container and isolated Neon branch.
- While CherryK has one developer, use local, `preview`, and `main`. Push reviewed
  work to `preview`, run the full gate and real Preview verification, then
  fast-forward the same green commit to `main`. Do not require feature branches or
  pull requests at this stage.
- Keep Vercel Git-driven. After successful `main` verification, GitHub publishes an
  immutable ARM64 image to GHCR and the Production-only OCI runner invokes only the
  root-owned, serialized, health-gated deployment wrapper. Restrict the GitHub
  `Production` environment to `main` and never run general CI on that runner.
- Keep `Verify` as the required `main` check. Reuse the exact successful
  push-triggered `preview` result; run the full gate when the SHA has no matching
  success, the lookup fails, or the run is manual.
- Preserve stable `/api/v1` contracts and do not use dual writes. Do not add Redis,
  JWT, WebFlux, coroutines, microservices, or self-hosted PostgreSQL without measured
  need and a new decision.

## Authentication and Persistence

- Use Spring Security, Google OIDC, PostgreSQL-backed Spring Session, and verified
  issuer/subject identity in `user_identities`; never merge users by email alone.
- Guarded Flyway V9 removed legacy Better Auth tables after exact identity checks.
  Preserve all historical migrations so clean databases replay the transition and
  existing databases validate checksums.
- Keep admin authorization as verified Google identity plus `ADMIN_EMAILS` until
  role management is justified.
- Flyway alone changes schema and Hibernate stays on `ddl-auto=validate`. Use JPA
  for aggregate writes/simple CRUD and SQL projections for query-heavy reads. Keep
  BIGINT identity keys internal and opaque string IDs in JSON.
- Baseline an existing Neon database only after equivalence checks; never enable
  automatic Production baselining.
- Treat `neon_auth` as Neon-managed state; CherryK backups exclude it because
  authentication is owned by Spring OIDC.
- Resolve exact identifiers read-only before deleting expired external resources.
  Preserve the current deployment's previous image and Compose backup through its
  health and public smoke checks, and never remove the automatic rollback mechanism.
- During a database migration window, enable the same fail-closed `write-frozen`
  mode at Vercel and Spring. Block all public `/api/v1` and `/api/auth` requests,
  including GET-based session/OAuth writes; operator access requires the short-lived
  bypass cookie or protected header.

## AI, OCR, and Privacy

- Keep OCR and language-model providers separate. CLOVA General OCR V2 remains
  behind `OcrProvider`; OpenAI remains behind correction and quiz-draft interfaces.
- OCR returns an editable draft. Never persist voice recordings, OCR originals, or
  image bytes, and do not include extracted text or secrets in ordinary logs.
- Reserve usage atomically before provider calls; commit successful usage and release
  failed reservations. Meter text/OCR by request and future speech by duration.
- Future speech transcription may produce the editable correction draft, but keep
  pronunciation assessment as a separate provider/domain boundary.
- Defer Google Cloud Vision, speech-provider selection, and pronunciation assessment
  until representative quality, latency, and cost measurements justify them.

## Product UI

- Use a calm, high-contrast, mobile-first learning interface: warm white surfaces,
  deep blue-teal primary actions, restrained supporting color, generous whitespace,
  and explicit borders for controls and state changes. Keep shared page structure,
  typography, focus treatment, and button hierarchy consistent across learner and
  operator surfaces.
- Treat streak tracking and guest MCQ as independent future modules. The dashboard
  may reserve space and reusable presentation boundaries for them, but it must not
  fabricate activity data or bypass the current authenticated API contract before
  those product behaviors are implemented.
- Keep the signed-out home usable when the passive session check is unavailable.
  Suppress the passive authentication error there and disable header sign-in while
  the authentication boundary is unavailable instead of retrying a known failing
  maintenance endpoint.

## Quiz Domain

- `Quiz` owns exactly four choices and one answer; `QuizAttempt` is a separate append-only
  aggregate. Only approved quizzes are learner-visible, and approved content is
  immutable; changes use a new draft and retire the prior version on approval.
- Model grammar and vocabulary as explicit quiz types. Vocabulary uses an English
  definition, four Korean choices, one answer, and the compatibility tag
  `word_choice`.
- `questionEn` owns the learner instruction. Grammar `sentenceKo` contains only
  exercise content, except `unnatural`, which has no separate stem and may repeat
  the Korean instruction.
- Keep exact fingerprints separate from learning-target identity. Vocabulary uses
  the normalized answer; `sentence_order` and `unnatural` use the normalized correct
  choice; other grammar uses normalized exercise plus answer, scoped by type/tag.
- Reserve append-only target history for ordinary generation and edits, even after
  rejection or retirement. An unchanged target is allowed only for an explicit
  revision.
- Select vocabulary targets from the difficulty-tiered database catalog before the
  provider call; the provider cannot choose or replace them. PostgreSQL remains
  authoritative for full-history rejection. Never serialize accumulated target
  history into AI input; grammar retries may include only bounded current-batch
  exclusions.
- Attempts may reference only a choice belonging to the quiz. Learner reads never
  expose unapproved content, lifecycle state, or answers before submission.
- Keep admin command DTOs separate from learner read DTOs.

## Deferred

- Reconsider deferred infrastructure, authentication, OCR, and speech choices only
  with measured need and a new durable decision.

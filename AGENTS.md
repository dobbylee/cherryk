# Agent Operating Rules

This repository is the CherryK MVP with a Next.js frontend and Kotlin/Spring
backend.

Before planning or editing, read this file and `local/plan.md`. Keep the plan a
current-state router: do not copy completed rollout logs, test counts, or commit
lists into it. Read only the detail document linked for an active task. Durable
choices belong in `agent-harness/decisions.md`; completed history belongs in the
task detail, while resolved versions and structure come from manifests and code.

## Execution

- Resolve ambiguity only when it can change correctness, product behavior, privacy, operations, or rollout. Record durable choices in `agent-harness/decisions.md` and task-local rollout detail in the routed plan.
- Implement the smallest coherent slice. Do not refactor, reformat, or add future layers outside it.
- Define checkable success criteria. Add focused checks for bugs, validation, and behavior-preserving refactors.
- Use `pnpm` for app commands. `pnpm test` is the default full gate; backend integration tests require Docker.
- Report verification that could not run and its blocker.

## Project Boundaries

- Keep contracts in `src/lib/contracts`, frontend API helpers in `src/lib/api`,
  and backend AI integrations under the Spring provider boundaries.
- Keep Spring controllers thin. Put transactions in application services and
  never serialize JPA entities as API responses.
- Flyway alone owns new schema changes; Hibernate stays on `ddl-auto=validate`. Use JPA for aggregate writes/simple CRUD and SQL projections for query-heavy reads.
- Keep OCR and language-model providers separate. Never persist OCR image originals or expose unapproved AI quiz drafts.
- Keep ignored plans and handoffs under `local/`.

## Delivery

- Implement on `preview` and use its full CI result as the normal pre-Production
  gate. The branch is a verification lane, not a permanently hosted environment.
- Require an on-demand full-stack Preview only for changes whose risk depends on
  hosted integration, including authentication/session behavior, database or data
  migration, API routing, and deployment infrastructure. It must use a temporary
  backend and isolated non-Production database, and it must be removed after
  verification.
- After the required local/CI and, when applicable, on-demand Preview verification,
  fast-forward that exact commit to `main` and push `main` for Production.
- Never route Preview to Production or treat a frontend-only/read-only deployment as
  full-stack verification.
- Do not use Vercel Promote to Production.

## Required Review

Every implementation or harness change must:

1. Run relevant verification.
2. Use the project `reviewer` with `agent-harness/prompts/implementation-review.md`, limited to changed files.
3. Fix findings and repeat verification/review until the result is exactly `No Findings`.
4. Report verification commands and the final review result.

Add harness weight only for a concrete, repeatable failure that qualifies under
`agent-harness/workflow.md`.

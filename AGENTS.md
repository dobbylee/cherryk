# Agent Operating Rules

This repository is the CherryK MVP with a Next.js frontend and Kotlin/Spring
backend.

Before planning or editing, read this file and `local/plan.md`. The plan is a
router: read only the linked detail document needed for the active task.
Durable choices belong in `agent-harness/decisions.md`; resolved versions and
structure should be read from manifests and code.

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

- Implement and verify on `preview`.
- After real Preview verification, fast-forward that commit to `main` and push `main` for Production.
- Do not use Vercel Promote to Production.

## Required Review

Every implementation or harness change must:

1. Run relevant verification.
2. Use the project `reviewer` with `agent-harness/prompts/implementation-review.md`, limited to changed files.
3. Fix findings and repeat verification/review until the result is exactly `No Findings`.
4. Report verification commands and the final review result.

Add harness weight only for a concrete, repeatable failure that qualifies under
`agent-harness/workflow.md`.

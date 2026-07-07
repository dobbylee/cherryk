# Agent Operating Rules

This repository is the Korean Correction Coach MVP. Agents must read this file and `local/plan.md` before planning or editing. Stack and version decisions live in `agent-harness/decisions.md`; do not duplicate them here unless they change agent behavior.

## Think Before Coding

Do not assume, and do not hide confusion.

- State assumptions before implementation when the task is ambiguous.
- If multiple interpretations exist, name them and ask or present the tradeoff.
- If a simpler approach solves the request, say so and use it.
- Push back when a request would add avoidable complexity or weaken the MVP.
- If something is unclear enough to affect correctness, stop and ask.

## Simplicity First

Write the minimum code that solves the current request.

- Do not add features beyond what was asked.
- Do not add abstractions for single-use code.
- Do not add configurability or flexibility for hypothetical future needs.
- Do not add error handling for impossible scenarios.
- If the implementation feels larger than the problem, simplify before finishing.
- Future Spring migration is a boundary concern, not a reason to build speculative backend layers now.

## Surgical Changes

Touch only what the task requires.

- Do not refactor adjacent code unless the requested change needs it.
- Do not reformat unrelated files.
- Match the existing style, even if you would normally choose another style.
- If you notice unrelated dead code or cleanup, mention it instead of deleting it.
- Remove imports, variables, functions, files, and docs that your own change made unused.
- Every changed line should trace back to the user's request.

## Goal-Driven Execution

Turn tasks into verifiable goals and loop until verified.

- For validation work, add or update tests for invalid inputs before calling it done.
- For bug fixes, reproduce the bug with a test or concrete check, then make it pass.
- For refactors, verify behavior before and after when feasible.
- For multi-step tasks, state a short plan with a verification step for each part.
- Use `pnpm` for app commands.
- Treat `pnpm test` as the default local quality gate; it runs lint, typecheck, and unit tests.
- If a verification command cannot run, report the blocker plainly.

## Project-Specific Guardrails

- Keep API contracts under `src/lib/contracts`.
- Keep frontend fetch helpers under `src/lib/api`.
- Keep server-only AI code under `src/server/ai`.
- Keep DB access behind server-side repository/service boundaries.
- Keep route handlers thin: validation, service call, response formatting.
- Do not store OCR image originals.
- Do not expose AI quiz drafts to users; user-facing quiz content must be approved.
- Keep local-only planning and handoff notes under `local/`; that directory is intentionally ignored.

## Required Review Loop

Every implementation change must run a subagent review loop before final delivery.

1. Finish the local implementation and run relevant verification.
2. Spawn a subagent with reasoning effort `xhigh` using `agent-harness/prompts/xhigh-implementation-review.md`.
3. The subagent must review only the changed files for the implementation.
4. If the subagent returns findings, fix them and run verification again.
5. Repeat the review-improvement loop until the subagent's final result is exactly `No Findings`.
6. Final responses must mention the review loop result and the verification commands run.

Do not broaden the reviewed file set unless the implementation touched shared behavior outside the original scope.

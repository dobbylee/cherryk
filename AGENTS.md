# Agent Operating Rules

This repository is the CherryK MVP. Agents must read this file and `local/plan.md` before planning or editing. Stack and version decisions live in `agent-harness/decisions.md`; do not duplicate them here unless they change agent behavior.

## Working Principles

- Resolve ambiguity before coding only when it can change correctness or product behavior; otherwise state the reasonable assumption and proceed.
- Use the smallest implementation that solves the request. Avoid speculative features, one-off abstractions, and premature backend layers for a future Spring migration.
- Keep changes surgical: do not refactor, reformat, or clean up unrelated code. Remove only artifacts made unused by the current change.
- Turn the request into verifiable success criteria. Reproduce bugs with a test or concrete check, test invalid inputs for validation work, and verify refactors before and after when feasible.
- Use `pnpm` for app commands. `pnpm test` is the default local quality gate and runs lint, typecheck, and unit tests.
- Report any verification command that cannot run and its blocker.

## Harness Evolution

Improve the harness only for concrete, repeatable failures. Score candidates with `agent-harness/workflow.md`; when one qualifies, add the smallest safeguard and verify that it catches or prevents the failure. Prefer executable checks, and merge or remove duplicate prose rules. Keep durable workflow rules in `AGENTS.md` or `agent-harness/`; keep product plans and handoff notes in `local/`.

## Decision Ownership

Do not make business or product decisions silently.

- If implementation depends on a product, learning, privacy, operations, or rollout decision that is not already decided, pause and present a recommended option with tradeoffs.
- Separate confirmed decisions from assumptions and recommendations.
- Record user-confirmed project decisions in the appropriate planning document instead of burying them in code comments or final-message prose.

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

Every implementation change must run a subagent review loop before final delivery. Use the project `reviewer` agent, configured at `xhigh` reasoning effort in `.codex/agents/reviewer.toml`; do not pin a model name so it inherits the current model.

1. Finish the local implementation and run relevant verification.
2. Spawn the `reviewer` subagent using `agent-harness/prompts/implementation-review.md`.
3. The subagent must review only the changed files for the implementation.
4. If the subagent returns findings, fix them and run verification again.
5. Repeat the review-improvement loop until the subagent's final result is exactly `No Findings`.
6. Final responses must mention the review loop result and the verification commands run.

Do not broaden the reviewed file set unless the implementation touched shared behavior outside the original scope.

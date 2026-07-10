# Implementation Workflow

Use this checklist for each implementation task.

1. Read `AGENTS.md` and `local/plan.md`.
2. Resolve ambiguity or product decisions that can change correctness or scope.
3. Define checkable success criteria and the smallest coherent implementation slice.
4. Edit only the files needed for that slice.
5. Run focused verification that matches the success criteria.
6. If the task exposed a repeatable failure mode, evaluate it with the harness rubric below. When it qualifies, add the smallest safeguard and verify that it catches or prevents the failure.
7. Ask the project `reviewer` subagent to review the changed files with `agent-harness/prompts/implementation-review.md`.
8. Fix every valid finding, then repeat verification and review until the reviewer returns exactly `No Findings`.
9. Summarize changed files, verification, review result, and any harness rule added or deliberately skipped.

## Success Criteria Examples

- "Add validation" means invalid inputs have tests and are rejected.
- "Fix a bug" means there is a reproducing check and the check passes.
- "Refactor" means behavior is verified before and after when feasible.
- "Add UI" means the expected state, loading, error, and mobile behavior are checked at the appropriate scope.

## Decision Gate

Use this gate before implementation when a task touches product behavior, learning policy, privacy, operations, rollout, or user-visible scope.

1. Name the undecided question.
2. List 2-3 realistic options.
3. Recommend one option and explain why it best serves the MVP.
4. State the implementation consequence of the recommended option.
5. Wait for the user when the decision changes product behavior or creates a durable constraint.

Do not use the decision gate for purely mechanical choices that are already implied by the codebase, such as matching local naming, file placement, or existing helper patterns.

## Harness Update Rubric

Use this rubric when a bug, review finding, manual-test miss, or recurring confusion suggests a new rule. Score each factor from 0 to 3.

- Severity: 0 cosmetic, 1 minor local inconvenience, 2 user-visible or repeated engineering cost, 3 security/privacy/data-loss/product-trust risk.
- Recurrence: 0 one-off, 1 plausible but rare, 2 already repeated or likely across nearby work, 3 systemic pattern.
- Detectability: 0 obvious during normal coding, 1 likely caught by review, 2 easy to miss without an explicit check, 3 invisible until user/manual testing.
- Rule fit: 0 too broad or speculative, 1 prose reminder only, 2 focused checklist or review prompt, 3 cheap executable test or automated check.

Add or change a harness rule only when the total score is at least 8, or when Severity is 3 and Rule fit is at least 2. Otherwise, mention the issue in the task notes and avoid adding permanent harness weight.

## Harness Update Placement

- Add tests when the failure is deterministic and cheap to exercise.
- Add a reviewer prompt check when the failure requires architectural or judgment-based review.
- Add `AGENTS.md` guidance only for durable behavior that every agent must follow.
- Add `agent-harness/workflow.md` guidance for process, scoring, and handoff rules.
- Add stack or version decisions to `agent-harness/decisions.md`.
- Add product plans, decision records, and session handoffs to `local/plan.md`.

When adding a harness rule, state the triggering failure mode, the score, and why the chosen placement is the smallest effective safeguard. If an existing rule covers it, tighten that rule instead of adding another one.

## Default Phase Order

1. Project setup
2. Auth and invite sessions
3. Correction flow with mock AI
4. OCR extraction flow
5. Quiz DB and admin review
6. Quiz recommendation and attempts
7. Polish, rate limiting, deployment

# Implementation Workflow

Use this checklist for each implementation task.

1. Read `AGENTS.md` and `local/plan.md`.
2. State assumptions or ask if the task has multiple plausible meanings.
3. Define success criteria in a form that can be checked.
4. Identify the smallest coherent implementation slice.
5. Edit only the files needed for that slice.
6. Run focused verification that matches the success criteria.
7. Ask an xhigh subagent to review the changed files with `agent-harness/prompts/xhigh-implementation-review.md`.
8. Fix every valid finding.
9. Repeat verification and xhigh review until the reviewer returns exactly `No Findings`.
10. Summarize changed files, verification, and review result.

## Success Criteria Examples

- "Add validation" means invalid inputs have tests and are rejected.
- "Fix a bug" means there is a reproducing check and the check passes.
- "Refactor" means behavior is verified before and after when feasible.
- "Add UI" means the expected state, loading, error, and mobile behavior are checked at the appropriate scope.

## Default Phase Order

1. Project setup
2. Auth and invite sessions
3. Correction flow with mock AI
4. OCR extraction flow
5. Quiz DB and admin review
6. Quiz recommendation and attempts
7. Polish, rate limiting, deployment

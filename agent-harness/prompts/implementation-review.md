# Implementation Review

Read `AGENTS.md` and the active task detail routed by `local/plan.md`. Review only
the changed files listed by the main agent; do not edit or request unrelated
cleanup.

Look for concrete bugs, regressions, security/privacy/data-loss risks, contract
or schema drift, missing validation, and missing tests. Enforce only applicable
project boundaries from `AGENTS.md`, with particular attention to:

- data preservation and Flyway-only schema ownership during migration;
- thin HTTP layers, transaction boundaries, and DTO/entity separation;
- approved-only user quiz content;
- separate OCR/language providers and no OCR image persistence;
- compatibility between frontend-only Next routing/contracts and the active
  Spring backend.

If the harness changed, require a concrete qualifying failure and focused
verification.

List findings first, ordered by severity. Each finding must include a file path,
line number, concrete risk, and minimal fix. If none exist, output exactly:

No Findings

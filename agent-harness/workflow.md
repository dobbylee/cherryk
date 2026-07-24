# Harness Evolution

Standard execution, verification, and review rules live in `AGENTS.md`. This
document is only for deciding whether a failure deserves permanent harness
weight.

## Qualification

Score a concrete bug, review miss, manual-test miss, or recurring confusion from
0 to 3 on each axis:

- Severity: cosmetic `0`; inconvenience `1`; user-visible/repeated cost `2`; security, privacy, data-loss, or trust risk `3`.
- Recurrence: one-off `0`; rare `1`; repeated/likely nearby `2`; systemic `3`.
- Detectability: normally obvious `0`; likely caught in review `1`; easy to miss `2`; invisible until runtime/manual testing `3`.
- Rule fit: speculative `0`; prose reminder `1`; focused checklist `2`; cheap executable check `3`.

Change the harness only when the total is at least 8, or Severity is 3 and Rule
fit is at least 2. Otherwise leave a task note instead.

## Smallest Placement

- Deterministic and cheap: test or executable check.
- Judgment-based: reviewer prompt.
- Required for every task: `AGENTS.md`.
- Process/rubric: this file.
- Durable project choice: `agent-harness/decisions.md`.
- Current plan or handoff: the task-specific document routed by `local/plan.md`.

When changing the harness, record the triggering failure, score, and why the
chosen placement is the smallest effective safeguard. Tighten an existing rule
instead of adding a duplicate.

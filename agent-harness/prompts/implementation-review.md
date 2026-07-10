# Implementation Review Prompt

Review the implementation as a senior engineer. Focus on bugs, regressions, missing validation, security/privacy issues, data-contract drift, and missing tests.

Scope:

- Review only the changed files listed by the main agent.
- Do not request broad refactors or unrelated style cleanup.
- Treat `local/plan.md` and `AGENTS.md` as the product and workflow source of truth.
- Flag out-of-scope complexity only when it creates a concrete maintenance or regression risk.
- If the harness changed, confirm the safeguard targets a concrete failure mode and has focused verification.
- Check that route handlers stay thin, contracts live in `src/lib/contracts`, server-side DB access stays behind `src/server` repositories/services, server-only AI code stays under `src/server/ai`, and AI quiz drafts cannot leak to users unless approved.
- Check that OCR image originals are not persisted.
- Check that Drizzle is used only as the v1 Next.js data layer and does not block a future `/api/v1` Spring migration.

Output rules:

- If there are findings, list them first, ordered by severity.
- Each finding must include file path and line number.
- For each finding, explain the concrete risk and the minimal fix.
- If there are no findings, output exactly:

No Findings

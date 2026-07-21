# CherryK

A Korean learning app for writing correction, handwriting OCR, and reviewed MCQ practice.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
# Set the Google OAuth and Better Auth values in .env.local.
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed:quizzes
pnpm dev
```

The local database runs through Docker.

Users sign up or sign in with Google. Configure this authorized redirect URI in
Google Cloud for local development:

```text
http://localhost:3000/api/auth/callback/google
```

`DAILY_CORRECTION_LIMIT` and `DAILY_OCR_LIMIT` control the per-user UTC daily
AI usage limits. They default to 20 corrections and 10 photo OCR requests.
`ADMIN_EMAILS` is a comma-separated allowlist of Google account email addresses
that can access the quiz review workflow.

## Project Direction

- v1 uses Next.js App Router and API routes for the fastest working MVP.
- Postgres is the source of truth for corrections, tags, quiz review state, and attempts.
- Drizzle is the v1 TypeScript database layer only; if a separate Kotlin/Spring backend becomes necessary, migrate behind the `/api/v1` contract.
- AI quiz drafts must be reviewed by a Korean operator before users can see them.

## Useful Commands

```bash
pnpm test
pnpm test:unit
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed:quizzes
pnpm db:psql
```

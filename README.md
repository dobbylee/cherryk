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

- The frontend remains Next.js on Vercel while `/api/v1` behavior moves from
  Next.js routes to the Kotlin/Spring backend.
- Neon Postgres remains the source of truth.
- AI quiz drafts require operator approval before users can see them.
- Backend migration and database-operation commands are documented in
  [`backend/README.md`](backend/README.md).

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

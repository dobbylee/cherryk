# Korean Correction Coach

Mobile-first web MVP for Korean writing correction, handwriting OCR, reviewed MCQ practice, and correction report downloads.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
# Set AUTH_SECRET in .env.local before seeding.
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed:dev
pnpm dev
```

The local database runs through Docker.

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
pnpm db:seed:dev
pnpm db:psql
```

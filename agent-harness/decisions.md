# Project Decisions

## Current Stack

- Frontend and v1 backend: Next.js App Router with TypeScript.
- Database: PostgreSQL 18.
- Local database: Docker Compose with the official `postgres:18` image.
- ORM/query layer for v1: Drizzle ORM.
- Package manager: pnpm.
- Deployment target for frontend/API v1: Vercel.

## Deferred Decisions

- A separate Kotlin/Spring backend is deferred until admin workflows, integrations, or operational complexity justify the split.
- If Spring is introduced later, keep the `/api/v1` contract and migrate DB access from Drizzle to the Spring backend behind that boundary.

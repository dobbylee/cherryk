# Project Decisions

## Current Stack

- Frontend and v1 backend: Next.js App Router with TypeScript.
- Database: PostgreSQL 18.
- Local database: Docker Compose with the official `postgres:18` image.
- ORM/query layer for v1: Drizzle ORM.
- Package manager: pnpm.
- Deployment target for frontend/API v1: Vercel.

## AI Runtime

- Use `gpt-5.6-luna` for text correction, quiz draft generation, and image OCR.
- Use `medium` reasoning effort for the preview baseline.
- Keep model names and reasoning effort in `AI_TEXT_MODEL`, `AI_VISION_MODEL`, and `AI_REASONING_EFFORT`; configure Preview and Production explicitly instead of hardcoding them in provider code.
- Validate mobile picker behavior and real-image OCR together on the Preview deployment before Production.

## Deferred Decisions

- A separate Kotlin/Spring backend is deferred until admin workflows, integrations, or operational complexity justify the split.
- If Spring is introduced later, keep the `/api/v1` contract and migrate DB access from Drizzle to the Spring backend behind that boundary.

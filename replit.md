# CampusQuery — College FAQ Intelligence System

CampusQuery answers natural-language university questions with grounded, ranked results from a PostgreSQL knowledge base.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/campus-query/src/App.tsx` — student and admin interface
- `artifacts/api-server/src/routes/campusquery.ts` — search, FAQ, student, and admin API routes
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `database/schema.sql` — PostgreSQL + pgvector DDL, constraints, indexes, triggers, views, and function
- `database/seed.sql` — demo departments, users, FAQs, documents, history, feedback, and bookmarks

## Architecture decisions

- Search uses a deterministic development embedding so the demo works without an external API key; the vector provider can be replaced behind the same stored `vector(8)` shape.
- FAQ retrieval combines PostgreSQL GIN full-text ranking and pgvector cosine similarity, then applies structured department/category filters.
- The demo session deliberately exposes Student/Admin role switching without storing local passwords; production auth should be connected to Clerk or Replit Auth.
- Document bytes are represented by metadata and file references; persistent uploads should use App Storage rather than storing blobs in PostgreSQL.

## Product

Students can ask and browse grounded campus questions, inspect sources and related answers, save bookmarks, rate answers, and revisit search history. Admins can review analytics, publish FAQs, and explore the database concepts behind the system.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm install` after changing the API Zod package because generated integer validators use the Zod 4 API.
- The app and API are separate managed services; restart both after route or frontend changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

# CampusQuery: College FAQ Intelligence System

CampusQuery answers natural-language university questions with grounded, ranked results from a hybrid MySQL + MongoDB knowledge base.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev`: run the API server
- `pnpm run typecheck`: full typecheck across all packages
- `pnpm run build`: typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen`: regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `MYSQL_URL` (MySQL connection URL), `MONGODB_URI` (MongoDB connection string), optional `MONGODB_DB` (default `CampusQuery`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Databases: MySQL (`mysql2`) for structured data, MongoDB (`mongodb`) for flexible knowledge content
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/campus-query/src/App.tsx`: student and admin interface
- `artifacts/api-server/src/routes/campusquery.ts`: search, FAQ, student, and admin API routes (MySQL queries)
- `artifacts/api-server/src/lib/knowledge.ts`: MongoDB knowledge, enrichment and snippet helpers
- `lib/db/src`: MySQL pool and lazy MongoDB client
- `lib/api-spec/openapi.yaml`: API contract source of truth
- `database/mysql/schema.sql`, `database/mysql/seed.sql`: MySQL DDL, views, procedure, function, trigger, and demo data
- `database/mongodb/init.js`: MongoDB collections, validators, seed documents, and indexes (run with `mongosh`)

## Architecture decisions

- MySQL is the source of truth for FAQs, users, feedback, bookmarks, history, and document metadata.
- MongoDB holds document content, tags, chunks, and FAQ enrichment (keywords/tags); `DOCUMENT_CHUNK` lives in MongoDB.
- Search blends InnoDB FULLTEXT score (70%) with MongoDB tag/keyword boost (30%) and returns matching knowledge documents alongside FAQs.
- If MongoDB is down, the API logs a warning and serves MySQL-only results.
- There is no cross-database transaction: MySQL commits first and Mongo enrichment is written afterwards (it is rebuildable).
- The demo session exposes Student/Admin role switching without passwords; production auth should be added.

## Gotchas

- Run `pnpm install` after changing the API Zod package because generated integer validators use the Zod 4 API.
- MySQL table names are case-sensitive on Linux; the schema uses the upper-case names from the project report (`FAQ`, `USER`, ...).
- The app and API are separate managed services; restart both after route or frontend changes.

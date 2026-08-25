---
name: Orval Zod compatibility
description: The generated API validators use Zod 4 integer syntax in this workspace.
---

The API Zod package must stay on a Zod version that supports `z.int()` when regenerating OpenAPI clients with the current Orval configuration.

**Why:** The workspace catalog pins Zod 3 for most packages, while the generated validator output uses the Zod 4 API.

**How to apply:** Keep the API Zod package dependency explicitly on Zod 4 and run install plus API codegen after OpenAPI changes.
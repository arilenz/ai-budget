# finance

Personal finance app. Track accounts, categorize transactions, sync Monobank.

## Layout

```
apps/
  api/         REST API (Hono + @hono/zod-openapi + Drizzle, SQLite)
  web/         TanStack Start web app — server functions only, no direct DB
  mobile/      React Native (Expo Router) — talks to the API directly
packages/
  api-client/  Typed client, generated from the API's OpenAPI spec
scripts/
  generate-api-client.sh   Dump spec from api → openapi.yaml → regenerate client
openapi.yaml   Source of truth for the API contract (committed)
finance.db     SQLite DB (gitignored)
```

There are no workspaces and no root `package.json`. Each app/package is a
self-contained npm project — install and run inside its own folder.

## Common commands

Run each from inside its own folder.

```sh
# api (port 3001)
cd apps/api && npm install
npm run start

# web (port 3000)
cd apps/web && npm install
npm run dev

# mobile (Expo)
cd apps/mobile && npm install
npm run start

# Regenerate openapi.yaml + packages/api-client/src/schema.ts
./scripts/generate-api-client.sh
```

## Data flow

- DB lives only behind `apps/api`. Web and mobile never open SQLite directly.
- Web's browser code never calls the API. All FE → API traffic goes through
  TanStack Start server functions, which read an `httpOnly` JWT cookie and call
  the API server-side via `packages/api-client`.
- Mobile calls the API directly with a bearer token stored in the platform
  keychain (`expo-secure-store`).

## OpenAPI workflow

1. Edit routes in `apps/api/src/routes/*.ts` (each uses `@hono/zod-openapi`).
2. Run `./scripts/generate-api-client.sh` — dumps `openapi.yaml` and regenerates
   `packages/api-client/src/schema.ts`. No running server required.
3. Commit `openapi.yaml` alongside the code change so PRs surface contract
   changes.

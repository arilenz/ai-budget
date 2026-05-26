# web

TanStack Start web app. Uses server functions for all FE → backend traffic; the
browser never calls `apps/api` directly.

## Setup

```sh
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

The API must be running on `http://localhost:3001` (or whatever `API_URL` in
`.env` points at) for server functions to work.

## Env vars

- `API_URL` — base URL for the API (server-side only). Default `http://localhost:3001`.

## How it talks to the API

- `src/lib/api-server.ts` builds an authenticated `@finance/api-client` instance
  on the server, pulling the JWT from the `auth_token` cookie.
- `src/lib/*.functions.ts` are thin server functions that wrap api-client calls.
  Components call them via `useServerFn(...)` — no `fetch` from the browser.
- Auth: `src/lib/auth.ts` sets/clears the `httpOnly` JWT cookie and calls
  `/auth/me` through the api-client.

## Notes

- `tsconfig.json` and `package.json#imports` declare `#api-client` →
  `../../packages/api-client/src/index.ts`. Vite resolves it via tsconfig paths.
- Generated route tree lives at `src/routeTree.gen.ts` (TanStack Router plugin).

# API implementation plan

Plan for bringing `apps/api` in line with [`api-design.md`](./api-design.md).
Scope is the API only: `apps/api`, `openapi.yaml`, `packages/api-client` and
`docs/`. Web and mobile are not touched.

---

## Decisions

| Topic | Decision |
| --- | --- |
| Backward compatibility | None. Replaced routes (`/auth/*`, `/sync/*`) are removed outright |
| Email | A `Mailer` service that sends nothing. A real provider is plugged in later without changing callers |
| Email verification | `EMAIL_VERIFICATION_ENABLED` (default `false`). While off, all users are treated as verified. Turning it on is a config change only |
| Deleting an account or category with transactions | `409 account_has_transactions` / `409 category_has_transactions` |
| Sync | Synchronous, `200` with the sync result |
| Refresh token grace period | Dropped. Reusing a rotated refresh token always revokes the session. Clients must not refresh in parallel |
| OAuth authorize page | Supports both password and Google login |

---

## Definition of done (every task)

- Routes defined with `@hono/zod-openapi`.
- `openapi.yaml` and the client regenerated via `./scripts/generate-api-client.sh`.
- `apps/api/README.md` updated (routes, env vars).
- Tests cover the behavior described in the task.

---

## Phase 0: Foundations

### API-01: Set up API tests

- Integration tests only. Every test drives the real app through
  `app.request()`, so it covers routing, validation, middleware and SQLite.
  No unit tests for individual modules.
- Vitest, with a throwaway SQLite database per test file (`DATABASE_URL`
  pointed at a temp file).
- Helpers built on `app.request()`: create a user, log in, send authenticated
  requests.
- **Done when:** `npm test` runs in `apps/api`, with a smoke test for `/health`
  and one CRUD route.

### API-02: Switch from `db:push` to migrations

- Generate a starting migration from the current `schema.ts`, so later tasks
  can check in data migrations.
- **Done when:** `npm run db:migrate` builds a fresh database, and the existing
  `finance.db` is marked as already on that starting migration.

### API-03: Error format and status codes

Depends on: API-01

- Replace `{ error: string }` with `{ error: { code, message } }`, using a typed
  `ApiError(status, code, message)`.
- Validation failures return `400 validation_failed`. Add `401 unauthenticated`,
  `404 not_found` and a `500` handler for unexpected errors.
- Add shared error schemas to OpenAPI.

### API-04: Apply REST conventions to accounts, categories and transactions

Depends on: API-03

- Creates return `201` with a `Location` header.
- Deletes return `204`, or `404` when the item is missing or belongs to someone
  else.
- Deleting an account or category that still has transactions returns
  `409 account_has_transactions` or `409 category_has_transactions`.
- `PATCH /transactions/:id` changes only the fields sent.
- Add `GET /accounts/:id`.

---

## Phase 1: Users and sessions

### API-05: Database changes for users, identities and sessions

Depends on: API-02

- `users`: add `name` and `emailVerified`, and drop `passwordHash`.
- New `identities` table: `userId`, `provider` (`password` or `google`),
  `providerSubject`, `email`, `passwordHash`, `createdAt`. Each provider account
  can be linked only once.
- Rebuild `sessions` with:
  - an integer `id`, `client` (`first_party` or `mcp`) and `clientName`
  - hashes of the access and refresh tokens, with their expiry times
  - `lastUsedAt`, `authenticatedAt`, `expiresAt` and `revokedAt`
  - hashes of already-used refresh tokens, so a reused one can be recognized
- Data migration: each existing user's `passwordHash` becomes a `password`
  identity.

### API-06: Opaque tokens, auth middleware and config

Depends on: API-05

- Generate random tokens and store only their SHA-256 hashes.
- `requireAuth` looks up the session on every request. It rejects revoked
  sessions, expired access tokens (15 minutes), and sessions that are 30 days
  unused or 90 days old. It also rejects MCP tokens.
- Update `lastUsedAt`, but not on every request.
- `requireRecentLogin`: credentials must have been entered within 10 minutes,
  otherwise `403 recent_login_required`.
- Config setting `EMAIL_VERIFICATION_ENABLED` (default `false`), read through
  one `isEmailVerifiedOnSignup()` function.
- Remove `jose` and `JWT_SECRET`.

### API-07: Users endpoints

Depends on: API-06

- `POST /users` → `201`. Does not log in. `409 email_taken` if the email is in
  use. New users get `emailVerified = isEmailVerifiedOnSignup()`.
- `GET /users/:id` and `PATCH /users/:id` (`name`). `:id` must be the caller,
  otherwise `404`.
- Remove `/auth/signup` and `/auth/me`.

### API-08: Password login, session list and logout

Depends on: API-06

- `POST /sessions` with `method: "password"` → `201` session with tokens, or
  `401 invalid_credentials`.
- `GET /sessions` lists active sessions, including MCP ones, and marks the
  current one with `current`.
- `DELETE /sessions/:id` → `204`, and the session stops working immediately.
- Remove `/auth/login`.

### API-09: Refresh token rotation

Depends on: API-08

- `POST /sessions/:id/refresh` needs no `Authorization` header and returns a new
  pair of tokens.
- Every failure is `401`: `invalid_refresh_token` or `session_revoked`,
  including an unknown or wrong session ID.
- The old refresh token stops working as soon as it's used. Using it again
  revokes the whole session. No grace period.
- Only first-party sessions can be refreshed here.
- **Tests:** normal rotation, reusing an old token revokes the session, wrong
  session ID, MCP session rejected.

### API-10: Re-login and set password

Depends on: API-08

- `POST /sessions/:id/reauthenticate` with a password → `200` and updates
  `authenticatedAt`. The credentials must belong to the session's user.
- `POST /users/:id/set-password` (self, recent login) → `204`. Adds a `password`
  identity if the user has none and revokes the user's other sessions,
  including MCP sessions.

### API-11: Rate limiting

Depends on: API-03

- In-memory limiter → `429 rate_limited`.
- Applies to sign-up, login, refresh and password resets.
- Limits are keyed by IP, plus email where there is one.

---

## Phase 2: Google login and identities

### API-12: Google credential check

Depends on: API-05

- Two ways in: code + PKCE exchange (redirect flow), or `idToken` + `nonce`
  check (native SDK flow).
- Checks the audience against the configured client IDs.
- Returns `{ sub, email, emailVerified }`. An unverified Google email →
  `401 invalid_credentials`.
- New env vars: `GOOGLE_CLIENT_IDS`, `GOOGLE_CLIENT_SECRET`.

### API-13: Google login and re-login

Depends on: API-08, API-10, API-12

- `POST /sessions` with `method: "google"` finds or creates the user:
  - The Google account is already linked → log in as that user.
  - No user has that email → create the user (email verified) and log in.
  - A user with that email exists and is verified → link Google to them and
    log in.
  - A user with that email exists but isn't verified → `409 account_exists`.
- While `EMAIL_VERIFICATION_ENABLED=false`, every user counts as verified, so
  the `409` case never happens. It's still tested with the setting on.
- `reauthenticate` accepts Google too, and the Google account must belong to
  the session's user.

### API-14: Identities endpoints

Depends on: API-12

- `GET /users/:id/identities`.
- `POST /users/:id/identities` links a Google account (recent login) → `201`, or
  `409` if it's already linked to another user.
- `DELETE /users/:id/identities/:identityId` (recent login) → `204`, or
  `409 last_identity`.

---

## Phase 3: Password resets

### API-15: Mailer service

No dependencies.

- A `Mailer` interface with typed messages: `passwordReset`,
  `passwordResetNoPassword`, `passwordChanged`.
- The default implementation sends nothing. A real provider can be dropped in
  later without changing any code that calls it.
- Tests can inject a fake `Mailer` that records messages.

### API-16: Password resets

Depends on: API-10, API-11, API-15

- New `password_resets` table: hashed token, `expiresAt` (1 hour),
  `completedAt`.
- `POST /password-resets` → always `202`:
  - A user with a password gets a reset link, carrying `id` and `token` in the
    URL fragment.
  - A user without a password gets an email saying they sign in with Google.
  - Unknown emails get nothing.
- `GET /password-resets/:id` → `{ status, expiresAt }`.
- `POST /password-resets/:id/complete` → `204`. `404` for an unknown ID or wrong
  token, `410 reset_expired` if expired or already used.
- On success: set the password, mark the email verified, revoke all sessions,
  cancel other pending resets, and send `passwordChanged`.
- Until a mail provider is added, nobody receives these emails. Tests read the
  token from the fake `Mailer`.

---

## Phase 4: Connections, accounts, sync and rules

### API-17: Connections

Depends on: API-06

- New `connections` table: `provider`, token encrypted at rest (new env var
  `ENCRYPTION_KEY`), `status`.
- The Monobank client takes the token as an argument instead of reading
  `MONOBANK_TOKEN` from env.
- Endpoints:
  - `GET /connections` and `GET /connections/:id`.
  - `POST /connections` (recent login). The token is checked against Monobank's
    client-info endpoint; `400 invalid_provider_token` if rejected.
  - `POST /connections/:id/set-token` (recent login). Checks the token the same
    way and sets `status` back to `active`.
  - `DELETE /connections/:id` (recent login) → `204`. Linked accounts keep their
    transactions and become unlinked.

### API-18: External accounts

Depends on: API-17

- `GET /connections/:id/external-accounts` → `externalId`, `name`, `currency`,
  `balance`, `linkedAccountId`.
- If Monobank rejects the token, mark the connection `invalid`.

### API-19: Link accounts to connections

Depends on: API-04, API-17

- Account `type` becomes `cash | connected`. `monoAccountId` becomes
  `connectionId` + `externalAccountId`.
- `POST /accounts` accepts either a plain `name` (cash account) or `name` +
  `connectionId` + `externalAccountId` (linked account). Linking an external
  account that's already linked returns `409 external_account_linked`.
- Data migration: `mono` accounts become `connected`, and each owner gets a
  connection built from the current `MONOBANK_TOKEN`. After that,
  `MONOBANK_TOKEN` is removed.

### API-20: Move sync to `POST /accounts/:id/sync`

Depends on: API-19

- Runs synchronously and returns `200` with `inserted`, `fetched`, `rangeFrom`
  and `rangeTo`.
- `409 account_not_connected` for cash or unlinked accounts,
  `409 connection_invalid` if the token was rejected.
- When Monobank rejects the token (401/403), mark the connection `invalid`.
- Remove `/sync/mono-account/{id}`.

### API-21: Rules endpoints

Depends on: API-04

- `GET`, `POST`, `PATCH` and `DELETE /rules`.
- At least one condition must be set (`400`), and the `categoryId` must belong
  to the caller (`404`).
- Lowercase `descriptionPattern` when saving, because `ruleMatches` expects it
  lowercase.
- Test that the rule with the most conditions wins, then the newest.

### API-22: Move business logic out of route handlers

Depends on: API-04, API-20, API-21

- Move logic into `src/services/*` (accounts, categories, transactions, rules,
  reports, sync), each taking `userId`, so REST and MCP share one code path.
- Route handlers just translate between HTTP and those functions.

---

## Phase 5: OAuth and MCP

### API-23: OAuth discovery and client registration

Depends on: API-06

- `/.well-known/oauth-protected-resource` (RFC 9728) and
  `/.well-known/oauth-authorization-server` (RFC 8414).
- `POST /oauth/register` (RFC 7591) with a new `oauth_clients` table and checks
  on redirect URIs.
- New env var: `PUBLIC_URL`.

### API-24: `/oauth/authorize`

Depends on: API-13, API-23

- An HTML page served by the API, with password and Google login plus a consent
  screen showing the client's name and redirect domain.
- PKCE S256 is required, and `resource` must be the `/mcp` URL.
- Issues single-use authorization codes that expire quickly.

### API-25: `/oauth/token` and `/oauth/revoke`

Depends on: API-09, API-24

- Form-encoded, snake_case parameters.
- The `authorization_code` grant creates an MCP session with a 1-hour access
  token and a refresh token.
- The `refresh_token` grant uses the same rotation and reuse check as API-09,
  with no grace period, and accepts MCP sessions only.
- `/oauth/revoke` follows RFC 7009.

### API-26: `/mcp` endpoint and tools

Depends on: API-22, API-25

- Streamable HTTP endpoint for `POST` and `GET`.
- Accepts only MCP tokens. With no token it returns `401` with a
  `WWW-Authenticate` header pointing to the protected-resource metadata.
- Tools for accounts, categories, transactions, rules, reports and sync, calling
  the API-22 functions. They take no user ID.

---

## Docs

### API-27: Update `api-design.md` with the decisions

- Add `409 account_has_transactions` and `409 category_has_transactions` to the
  delete endpoints and the error code table.
- Remove the 30-second refresh grace period and say that clients must not run
  two refreshes at once.
- Describe the `EMAIL_VERIFICATION_ENABLED` setting and what happens while it's
  off.
- Say that sync is synchronous and returns `200`.

# API design

High-level structure of the Finance API contract: resources, operations,
conventions and authentication. `openapi.yaml` holds the exact
request/response schemas.

---

## 1. Clients and surfaces

| Client | Talks to | Auth |
| --- | --- | --- |
| Web (TanStack Start) | REST API, server-side only via server functions | Tokens in `httpOnly` cookies on the web origin |
| Mobile | REST API directly | Access token in memory, refresh token in `expo-secure-store` |
| MCP clients (Claude, IDEs, …) | `/mcp` only | OAuth 2.1: access + rotating refresh token |

The API exposes three surfaces:

1. **REST API** for first-party clients (web, mobile). Pragmatic REST.
2. **OAuth 2.1 authorization server** for MCP clients. RPC-style, as the specs define.
3. **MCP resource server** at `/mcp`. JSON-RPC (MCP protocol).

---

## 2. Conventions

### Style

- **Pragmatic REST**: URLs name resources, and plain CRUD uses HTTP methods
  (`GET`, `POST`, `PATCH`, `DELETE`). `PATCH` is a partial update: only the
  fields sent are changed.
- **Operations are named with a verb**:
  - On one resource: `POST /<resources>/:id/<verb>`, e.g.
    `POST /users/:id/set-password`.
  - On a collection: `POST /<resources>/<verb>`.
  - Always `POST`, with kebab-case verbs.
  - A verb is used instead of `PATCH` when the change is more than setting
    fields: it needs a credential or token, has side effects (revokes
    sessions, sends email, calls an external provider), or moves the resource
    to another state.
  - Response: `200` with the resource if there's something useful to return,
    otherwise `204`.
- **Creating a resource returns only that resource.** Related resources are
  referenced by ID (`userId`, `categoryId`), not embedded.
- **Real IDs in paths**, no aliases: `/users/:id`, `/sessions/:id` (no `/me`
  or `/current`). Clients keep the user and session IDs they receive at login.
- **IDs are integers.**
- **OAuth endpoints are RPC-style**: paths, parameters and form encoding
  follow the OAuth RFCs.

### Requests and responses

- JSON bodies with camelCase fields. OAuth endpoints use snake_case and form
  encoding, as the spec requires.
- Timestamps are ISO 8601 strings. Calendar dates are `YYYY-MM-DD`.
- Authenticated requests send `Authorization: Bearer <accessToken>`.
- Secrets (tokens) appear only in the response that creates or rotates them.
  Secrets sent by clients (passwords, provider tokens) are never returned.

### Status codes

| Case | Code |
| --- | --- |
| Created | `201` + `Location` header |
| Read / updated / operation with a body | `200` |
| Deleted / operation with no body | `204` |
| Accepted for asynchronous processing | `202` |
| Validation error | `400` |
| Missing, invalid or expired access token | `401` |
| Authenticated, but a recent login is required | `403` (`recent_login_required`) |
| Not found **or not owned by the caller** | `404`, so IDs can't be probed |
| Conflict | `409` |
| Expired or already-used one-time resource | `410` |
| Rate limited | `429` |

### Errors

```jsonc
{ "error": { "code": "account_exists", "message": "An account with this email already exists" } }
```

`code` is stable and machine-readable, and clients branch on it. `message` is
for humans. The error codes are listed in section 5.

### Ownership

- Every resource belongs to exactly one user, and every request is scoped to
  the user of the access token. User IDs in request bodies are never accepted.
- `/users/:id/**`: `:id` must be the caller, otherwise `404`.
- Top-level collections (`/accounts`, `/transactions`, …) return only the
  caller's resources. Referencing another user's resource by ID (for example
  `categoryId` in a transaction) returns `404`.

---

## 3. Authentication

### Tokens

| | First-party (web, mobile) | MCP clients |
| --- | --- | --- |
| Issued by | `POST /sessions` | `POST /oauth/token` (authorization code + PKCE) |
| Access token | Opaque, 15 min | Opaque, 1 h |
| Refresh token | Opaque, single-use | Opaque, single-use |
| Refreshed via | `POST /sessions/:id/refresh` | `POST /oauth/token` (`grant_type=refresh_token`) |
| Accepted by | REST API only | `/mcp` only |

- **Refresh rotation**: each refresh returns a new refresh token, and the old
  one stops working. Reusing an old refresh token revokes the whole session.
  Within 30 seconds of a rotation, the old token returns the same new token
  pair instead, so parallel requests from one client don't trigger this.
- **Revocation is immediate**: once a session is revoked, its access tokens
  are rejected on the next request.
- Each refresh endpoint accepts only its own kind of session.

### Sessions

A **session** represents one login (first-party) or one authorization (MCP
client). All tokens issued for it belong to the session.

- Expires after **30 days** without use, and **90 days** after login at the
  latest.
- **Recent login**: sensitive operations require that the user entered their
  credentials within the last **10 minutes**. Otherwise they return
  `403 recent_login_required`, and the client calls
  `POST /sessions/:id/reauthenticate`.
- `POST /users/:id/set-password` revokes all **other** sessions, including MCP
  sessions. Completing a password reset revokes **all** sessions.

### Identities

An **identity** is one way a user can log in. A user can have several, and
must always have at least one:

| Provider | Identified by |
| --- | --- |
| `password` | The user's email |
| `google` | The Google account ID (`sub`), not the email |

---

## 4. Endpoints

Auth column: **none** = no token, **user** = any valid first-party access
token, **self** = `:id` must be the caller, **recent** = recent login required.

### 4.1 Users

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/users` | Sign up with `{ email, password }` → `201` user. Does not log in | none |
| `GET` | `/users/:id` | Get the user | self |
| `PATCH` | `/users/:id` | Update the profile (`name`) | self |
| `POST` | `/users/:id/set-password` | `{ password }` → `204`. Sets or changes the password (adds a `password` identity if the user has none). Revokes other sessions | self, recent |

User: `id`, `email`, `emailVerified`, `name`, `createdAt`.

### 4.2 Sessions

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/sessions` | Log in → `201` session with tokens | none |
| `GET` | `/sessions` | List the caller's active sessions | user |
| `DELETE` | `/sessions/:id` | Revoke a session (logout = revoke your own) → `204` | user |
| `POST` | `/sessions/:id/refresh` | `{ refreshToken }` → `200` session with new tokens | refresh token |
| `POST` | `/sessions/:id/reauthenticate` | Credentials → `200` session. Satisfies the recent-login requirement | user |

Session: `id`, `userId`, `client` (`first_party` or `mcp`), `clientName`
(MCP only), `current` (in lists), `createdAt`, `lastUsedAt`, `expiresAt`,
`authenticatedAt`.

**`POST /sessions` body**, keyed by `method`:

```jsonc
{ "method": "password", "email": "…", "password": "…" }
{ "method": "google", "code": "…", "codeVerifier": "…", "redirectUri": "…" }  // redirect flow
{ "method": "google", "idToken": "…", "nonce": "…" }                          // native SDK flow
```

**Response** (also returned by `refresh`):

```jsonc
{
  "id": 42,
  "userId": 7,
  "client": "first_party",
  "createdAt": "…",
  "lastUsedAt": "…",
  "expiresAt": "…",
  "authenticatedAt": "…",
  "accessToken": "…",           // create and refresh responses only
  "accessTokenExpiresAt": "…",  // create and refresh responses only
  "refreshToken": "…"           // create and refresh responses only
}
```

**Google login** resolves the user as follows:

| Situation | Result |
| --- | --- |
| The Google account is already linked to a user | Session for that user |
| Not linked, no user with that email | Creates the user (email verified) with a `google` identity, then the session |
| Not linked, a user with that email exists, email verified | Links the Google account to that user, then the session |
| Not linked, a user with that email exists, email not verified | `409 account_exists`. The user logs in with their password and links Google via `POST /users/:id/identities` |
| Google reports the email as unverified | `401 invalid_credentials` |

**`POST /sessions/:id/refresh`**:

- No `Authorization` header; the access token may already be expired.
- Every failure returns `401` (`invalid_refresh_token` or `session_revoked`),
  including an unknown or mismatched session ID.
- Only first-party sessions can be refreshed here.

**`POST /sessions/:id/reauthenticate`** body:

```jsonc
{ "method": "password", "password": "…" }
{ "method": "google", "code": "…", "codeVerifier": "…", "redirectUri": "…" }
{ "method": "google", "idToken": "…", "nonce": "…" }
```

The credentials must belong to the session's user.

### 4.3 Identities

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/users/:id/identities` | List the user's login methods | self |
| `POST` | `/users/:id/identities` | Link a Google account → `201` identity. Body: a `google` credential, as in `POST /sessions` | self, recent |
| `DELETE` | `/users/:id/identities/:identityId` | Unlink → `204`. `409 last_identity` if it's the only one | self, recent |

Identity: `id`, `provider` (`password` or `google`), `email`, `createdAt`.

A `password` identity is added through `POST /users/:id/set-password`, not
through this collection.

### 4.4 Password resets

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/password-resets` | `{ email }` → `202`, no body | none |
| `GET` | `/password-resets/:id` | `{ status, expiresAt }`, where `status` is `pending`, `completed` or `expired` | none |
| `POST` | `/password-resets/:id/complete` | `{ token, password }` → `204` | none |

- `POST /password-resets` always returns `202`, whether or not the email
  belongs to a user.
  - A user with a password receives an email with a reset link.
  - A user without one receives an email saying they sign in with Google.
  - Unknown emails receive nothing.
- The emailed link carries `id` and `token` in the URL fragment.
- `complete`:
  - `404` for an unknown ID or wrong token.
  - `410` if the reset has expired or was already used.
  - On success: sets the password, marks the email verified, revokes all
    sessions, invalidates other pending resets, and emails a "password
    changed" notice. No session is created.
- A reset link is valid for 1 hour.

### 4.5 Connections

A **connection** links the user to an external financial provider. It holds
the provider credentials that accounts use to sync.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/connections` | List connections | user |
| `POST` | `/connections` | `{ provider: "monobank", token }` → `201` connection. The token is verified with the provider | user, recent |
| `GET` | `/connections/:id` | Get a connection | user |
| `DELETE` | `/connections/:id` | Remove the connection → `204`. Linked accounts keep their transactions and become unlinked | user, recent |
| `POST` | `/connections/:id/set-token` | `{ token }` → `200` connection. Replaces the credentials; the token is verified with the provider | user, recent |
| `GET` | `/connections/:id/external-accounts` | List the provider's accounts available for linking | user |

Connection: `id`, `provider` (`monobank`), `status` (`active`, or `invalid`
when the provider rejects the token), `createdAt`, `updatedAt`. The token is
never returned.

External account: `externalId`, `name`, `currency`, `balance`,
`linkedAccountId` (`null` if not linked yet).

Errors: `400 invalid_provider_token` if the provider rejects the token.

### 4.6 Accounts

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/accounts` | List accounts | user |
| `POST` | `/accounts` | Create an account → `201` | user |
| `GET` | `/accounts/:id` | Get an account | user |
| `PATCH` | `/accounts/:id` | Update (`name`) | user |
| `DELETE` | `/accounts/:id` | Delete → `204` | user |
| `POST` | `/accounts/:id/sync` | Import new transactions from the provider → `200` sync result | user |

Account: `id`, `userId`, `name`, `type` (`cash` or `connected`),
`connectionId`, `externalAccountId`, `lastSyncedAt`, `createdAt`,
`updatedAt`.

`POST /accounts` body:

```jsonc
{ "name": "Wallet" }                                                    // cash account
{ "name": "Mono black", "connectionId": 3, "externalAccountId": "…" }   // linked to a provider account
```

- Linking an external account that is already linked returns
  `409 external_account_linked`.
- `sync`:
  - `409 account_not_connected` for cash or unlinked accounts.
  - `409 connection_invalid` if the connection's token was rejected.
  - Sync result: `inserted`, `fetched`, `rangeFrom`, `rangeTo`.
  - New transactions are categorized by the user's rules (section 4.9).

### 4.7 Categories

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/categories` | List categories | user |
| `POST` | `/categories` | Create → `201` | user |
| `PATCH` | `/categories/:id` | Update (`name`) | user |
| `DELETE` | `/categories/:id` | Delete → `204` | user |

Category: `id`, `userId`, `name`, `createdAt`, `updatedAt`.

### 4.8 Transactions

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/transactions` | List. Filters: `accountId`, `categoryId`, `from`, `to` (dates) | user |
| `POST` | `/transactions` | Create → `201` | user |
| `PATCH` | `/transactions/:id` | Update any of `accountId`, `categoryId`, `description`, `amount` | user |
| `DELETE` | `/transactions/:id` | Delete → `204` | user |

Transaction: `id`, `accountId`, `categoryId`, `description`, `amount`,
`accountName`, `categoryName`, `createdAt`, `updatedAt`.

Changing `categoryId` of a transaction may create a rule so that similar
future transactions get the same category (section 4.9).

### 4.9 Rules

A **rule** assigns a category to transactions matching its conditions.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/rules` | List rules | user |
| `POST` | `/rules` | Create → `201` | user |
| `PATCH` | `/rules/:id` | Update | user |
| `DELETE` | `/rules/:id` | Delete → `204` | user |

Rule: `id`, `categoryId`, `mcc`, `counterIban`, `descriptionPattern`,
`createdAt`, `updatedAt`.

- At least one condition (`mcc`, `counterIban`, `descriptionPattern`) must be
  set, otherwise `400`.
- A transaction matches when **all** set conditions match.
  `descriptionPattern` is a case-insensitive substring match.
- If several rules match, the one with the most conditions wins, and among
  equals the newest.
- Rules apply to transactions imported by sync.

### 4.10 Reports

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/reports/monthly-breakdown?month=YYYY-MM` | Spending by category for a month | user |

Row: `categoryId`, `categoryName`, `total`, `txCount`.

### 4.11 OAuth 2.1 authorization server

| Method | Path | Purpose | Spec |
| --- | --- | --- | --- |
| `GET` | `/.well-known/oauth-protected-resource` | Tells MCP clients which authorization server to use | RFC 9728 |
| `GET` | `/.well-known/oauth-authorization-server` | Authorization server metadata | RFC 8414 |
| `POST` | `/oauth/register` | Dynamic client registration | RFC 7591 |
| `GET` | `/oauth/authorize` | Authorization request. Browser-facing: the user logs in and approves the client | OAuth 2.1 |
| `POST` | `/oauth/token` | `authorization_code` and `refresh_token` grants, MCP clients only | OAuth 2.1 |
| `POST` | `/oauth/revoke` | Token revocation | RFC 7009 |

Authorization flow:

1. The client calls `/mcp` without a token → `401` with a `WWW-Authenticate`
   header pointing to the protected-resource metadata.
2. The client discovers the authorization server and registers.
3. The user's browser opens `/oauth/authorize` (PKCE,
   `resource=<mcp url>`). The user logs in and approves the client, which is
   shown with its name and redirect domain.
4. The client exchanges the code at `/oauth/token` and receives an access
   token and refresh token for a new MCP session.

### 4.12 MCP

| Method | Path | Purpose |
| --- | --- | --- |
| `POST`, `GET` | `/mcp` | MCP Streamable HTTP endpoint (JSON-RPC) |

- An MCP access token grants full access to all MCP tools.
- Tools cover: accounts, categories, transactions, rules, reports and sync.
- Not available via MCP: users, passwords, sessions, identities, password
  resets and connections.
- Tools always act as the token's user and take no user ID argument.

### 4.13 Meta

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/openapi.json` | OpenAPI document |
| `GET` | `/docs` | Swagger UI |

---

## 5. Error codes

| Code | Status | Returned by |
| --- | --- | --- |
| `validation_failed` | `400` | Any endpoint with a request body or query |
| `invalid_provider_token` | `400` | `POST /connections`, `POST /connections/:id/set-token` |
| `unauthenticated` | `401` | Any authenticated endpoint: missing, invalid or expired access token |
| `invalid_credentials` | `401` | `POST /sessions`, `POST /sessions/:id/reauthenticate` |
| `invalid_refresh_token` | `401` | `POST /sessions/:id/refresh` |
| `session_revoked` | `401` | `POST /sessions/:id/refresh` |
| `recent_login_required` | `403` | Endpoints marked **recent** |
| `not_found` | `404` | Any endpoint with an ID |
| `email_taken` | `409` | `POST /users` |
| `account_exists` | `409` | `POST /sessions` (Google) |
| `last_identity` | `409` | `DELETE /users/:id/identities/:identityId` |
| `external_account_linked` | `409` | `POST /accounts` |
| `account_not_connected` | `409` | `POST /accounts/:id/sync` |
| `connection_invalid` | `409` | `POST /accounts/:id/sync` |
| `reset_expired` | `410` | `POST /password-resets/:id/complete` |
| `rate_limited` | `429` | Sign-up, login, refresh, password resets |

import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { ApiError } from "#/lib/api-error.ts";
import { db } from "#/db/index.ts";
import { users } from "#/db/schema.ts";
import { issueToken } from "#/lib/jwt.ts";
import { createRouter } from "#/lib/router.ts";
import {
  hashPassword,
  isPasswordValid,
  normalizeEmail,
  verifyPassword,
} from "#/lib/passwords.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  errorResponse,
  unauthenticatedResponse,
  userSchema,
  validationFailedResponse,
} from "#/schemas/common.ts";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const sessionSchema = z
  .object({
    token: z.string(),
    user: userSchema,
  })
  .openapi("Session");

export const auth = createRouter();

const signupRoute = createRoute({
  method: "post",
  path: "/signup",
  tags: ["auth"],
  request: {
    body: { content: { "application/json": { schema: credentialsSchema } } },
  },
  responses: {
    200: {
      description: "Signed up",
      content: { "application/json": { schema: sessionSchema } },
    },
    400: validationFailedResponse,
    409: errorResponse("Email already registered"),
  },
});

auth.openapi(signupRoute, async (c) => {
  const body = c.req.valid("json");
  const email = normalizeEmail(body.email);
  if (!email) throw ApiError.validationFailed("email: Email is required");
  if (!isPasswordValid(body.password)) {
    throw ApiError.validationFailed(
      "password: Password must be at least 8 characters",
    );
  }
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    throw new ApiError(409, "email_taken", "Email is already registered");
  }
  const passwordHash = await hashPassword(body.password);
  const created = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning()
    .get();
  const token = await issueToken(created.id);
  return c.json({ token, user: { id: created.id, email: created.email } }, 200);
});

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["auth"],
  request: {
    body: { content: { "application/json": { schema: credentialsSchema } } },
  },
  responses: {
    200: {
      description: "Logged in",
      content: { "application/json": { schema: sessionSchema } },
    },
    400: validationFailedResponse,
    401: errorResponse("Invalid credentials"),
  },
});

auth.openapi(loginRoute, async (c) => {
  const body = c.req.valid("json");
  const email = normalizeEmail(body.email);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (!user) {
    throw new ApiError(401, "invalid_credentials", "Invalid email or password");
  }
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) {
    throw new ApiError(401, "invalid_credentials", "Invalid email or password");
  }
  const token = await issueToken(user.id);
  return c.json({ token, user: { id: user.id, email: user.email } }, 200);
});

const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["auth"],
  middleware: [requireAuth] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: userSchema } },
    },
    401: unauthenticatedResponse,
  },
});

auth.openapi(meRoute, (c) => {
  const user = c.get("user");
  return c.json({ id: user.id, email: user.email }, 200);
});

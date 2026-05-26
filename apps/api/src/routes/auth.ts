import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "#/db/index.ts";
import { users } from "#/db/schema.ts";
import { issueToken } from "#/lib/jwt.ts";
import {
  hashPassword,
  isPasswordValid,
  normalizeEmail,
  verifyPassword,
} from "#/lib/passwords.ts";
import { requireAuth, type AuthEnv } from "#/middleware/auth.ts";
import { errorSchema, userSchema } from "#/schemas/common.ts";

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

export const auth = new OpenAPIHono<AuthEnv>();

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
    409: {
      description: "Email already registered",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

auth.openapi(signupRoute, async (c) => {
  const body = c.req.valid("json");
  const email = normalizeEmail(body.email);
  if (!email) throw new HTTPException(400, { message: "Email is required" });
  if (!isPasswordValid(body.password)) {
    throw new HTTPException(400, {
      message: "Password must be at least 8 characters",
    });
  }
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    throw new HTTPException(409, { message: "Email is already registered" });
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
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: errorSchema } },
    },
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
    throw new HTTPException(401, { message: "Invalid email or password" });
  }
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) {
    throw new HTTPException(401, { message: "Invalid email or password" });
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
    401: {
      description: "Unauthenticated",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

auth.openapi(meRoute, (c) => {
  const user = c.get("user");
  return c.json({ id: user.id, email: user.email }, 200);
});

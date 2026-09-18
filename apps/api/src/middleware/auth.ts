import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { ApiError } from "#/lib/api-error.ts";
import { db } from "#/db/index.ts";
import { users, type User } from "#/db/schema.ts";
import { verifyToken } from "#/lib/jwt.ts";

export type AuthEnv = {
  Variables: { user: User };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthenticated("Missing bearer token");
  }
  const token = header.slice("Bearer ".length).trim();
  let userId: number;
  try {
    const payload = await verifyToken(token);
    userId = Number(payload.sub);
    if (!Number.isFinite(userId)) throw new Error("bad sub");
  } catch {
    throw ApiError.unauthenticated("Invalid token");
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    throw ApiError.unauthenticated("Invalid token");
  }
  c.set("user", user);
  await next();
});

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { users, type User } from "#/db/schema.ts";
import { verifyToken } from "#/lib/jwt.ts";

export type AuthEnv = {
  Variables: { user: User };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length).trim();
  let userId: number;
  try {
    const payload = await verifyToken(token);
    userId = Number(payload.sub);
    if (!Number.isFinite(userId)) throw new Error("bad sub");
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    throw new HTTPException(401, { message: "User not found" });
  }
  c.set("user", user);
  await next();
});

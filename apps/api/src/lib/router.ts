import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthEnv } from "#/middleware/auth.ts";
import { validationHook } from "#/middleware/errors.ts";

/**
 * Every router is created here so that validation failures always produce the
 * shared error shape instead of the zod-openapi default.
 */
export const createRouter = (): OpenAPIHono<AuthEnv> =>
  new OpenAPIHono<AuthEnv>({ defaultHook: validationHook });

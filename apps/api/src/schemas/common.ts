import { z } from "@hono/zod-openapi";

export const errorSchema = z
  .object({ error: z.string() })
  .openapi("Error");

export const userSchema = z
  .object({
    id: z.number().int(),
    email: z.string().email(),
  })
  .openapi("User");

export const okSchema = z
  .object({ ok: z.literal(true) })
  .openapi("Ok");

export const idParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { in: "path" } }),
});

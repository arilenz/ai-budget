import { z } from "@hono/zod-openapi";
import { ERROR_CODES } from "#/lib/api-error.ts";

export const errorSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
    }),
  })
  .openapi("Error");

/** Shorthand for the error responses of an OpenAPI route definition. */
export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

export const unauthenticatedResponse = errorResponse(
  "Missing, invalid or expired access token",
);

export const validationFailedResponse = errorResponse("Validation failed");

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

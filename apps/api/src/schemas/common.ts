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

/** A `201` that returns the new resource and points at it with `Location`. */
export const createdResponse = <T extends z.ZodTypeAny>(
  description: string,
  schema: T,
) => ({
  description,
  headers: z.object({
    Location: z.string().openapi({ description: "URL of the new resource" }),
  }),
  content: { "application/json": { schema } },
});

export const deletedResponse = { description: "Deleted" };

export const idParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { in: "path" } }),
});

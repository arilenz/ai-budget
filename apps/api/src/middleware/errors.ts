import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ZodError } from "zod";
import { ApiError, toApiError } from "#/lib/api-error.ts";

type ValidationResult = { success: true } | { success: false; error: ZodError };

const describeIssues = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

/**
 * Turns request validation failures into an `ApiError`, so they travel the same
 * path as every other error. Pass this to every `OpenAPIHono` that validates.
 */
export const validationHook = (result: ValidationResult): void => {
  if (result.success) return;
  throw ApiError.validationFailed(describeIssues(result.error));
};

/**
 * Last stop for every error. Anything that is not an `ApiError` becomes a
 * `500 internal_error`, so the response body always has the same shape.
 */
export const handleError: ErrorHandler = (error, c) => {
  const apiError = toApiError(error);
  if (apiError.status >= 500) console.error(error);
  return c.json(apiError.body, apiError.status);
};

export const handleNotFound: NotFoundHandler = (c) =>
  c.json(ApiError.notFound("Route not found").body, 404);

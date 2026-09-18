import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** The catalogue from section 5 of docs/api-design.md, plus `internal_error`. */
export const ERROR_CODES = [
  "validation_failed",
  "invalid_provider_token",
  "unauthenticated",
  "invalid_credentials",
  "invalid_refresh_token",
  "session_revoked",
  "recent_login_required",
  "not_found",
  "email_taken",
  "account_exists",
  "last_identity",
  "external_account_linked",
  "account_not_connected",
  "connection_invalid",
  "reset_expired",
  "rate_limited",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorBody = {
  readonly error: { readonly code: ErrorCode; readonly message: string };
};

/**
 * The only error shape the API returns. `code` is stable and clients branch on
 * it; `message` is for humans.
 */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get body(): ErrorBody {
    return { error: { code: this.code, message: this.message } };
  }

  static validationFailed(message: string): ApiError {
    return new ApiError(400, "validation_failed", message);
  }

  static unauthenticated(message = "Authentication required"): ApiError {
    return new ApiError(401, "unauthenticated", message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, "not_found", message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, "internal_error", message);
  }
}

/**
 * Hono itself throws `HTTPException` for a few cases we never raise ourselves,
 * such as a malformed JSON body. Only statuses with a generic code are carried
 * over, so the status and the code can never disagree.
 */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: "validation_failed",
  401: "unauthenticated",
  404: "not_found",
  429: "rate_limited",
};

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof HTTPException) {
    const code = CODE_BY_STATUS[error.status];
    if (code) return new ApiError(error.status, code, error.message);
  }
  return ApiError.internal();
};

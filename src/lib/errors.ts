export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError("BAD_REQUEST", msg, 400, details);
export const unauthorized = (msg = "Sign in required") => new AppError("UNAUTHORIZED", msg, 401);
export const forbidden = (msg = "Not allowed") => new AppError("FORBIDDEN", msg, 403);
export const notFound = (msg = "Not found") => new AppError("NOT_FOUND", msg, 404);
export const conflict = (msg: string) => new AppError("CONFLICT", msg, 409);
export const limitReached = (msg: string, details?: unknown) =>
  new AppError("LIMIT_REACHED", msg, 402, details);
export const tooMany = (msg = "Too many requests") => new AppError("RATE_LIMITED", msg, 429);
export const internal = (msg = "Something went wrong") => new AppError("INTERNAL", msg, 500);

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";
import { rateLimit, clientKey } from "./ratelimit";
import { hasAI } from "./env";

export type RouteContext = { req: NextRequest; requestId: string; ip: string | null };

type Handler<P = Record<string, string>> = (
  ctx: RouteContext & { params: P }
) => Promise<NextResponse | Response>;

export function withRoute<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { rateLimit?: { limit: number; windowSec: number }; name: string } = { name: "route" }
) {
  return async (req: NextRequest, args: { params?: P } = {}) => {
    const requestId = crypto.randomUUID();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const started = Date.now();
    try {
      if (opts.rateLimit) {
        const rl = rateLimit(clientKey(opts.name, ip, req.headers.get("cookie")?.slice(0, 24)), opts.rateLimit);
        if (!rl.ok) {
          return NextResponse.json(
            { error: { code: "RATE_LIMITED", message: "Too many requests. Slow down." } },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
          );
        }
      }
      const res = await handler({ req, requestId, ip, params: (args.params ?? {}) as P });
      logger.debug("request", { route: opts.name, ms: Date.now() - started, status: res.status });
      return res;
    } catch (err) {
      return errorResponse(err, requestId, opts.name);
    }
  };
}

function errorResponse(err: unknown, requestId: string, route: string) {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const pathStr = firstIssue?.path?.join(".");
    const issueMsg = firstIssue?.message;
    const message =
      issueMsg && issueMsg !== "Required" && issueMsg !== "Invalid input"
        ? pathStr
          ? `${pathStr}: ${issueMsg}`
          : issueMsg
        : pathStr
        ? `Invalid ${pathStr}`
        : "Invalid input";

    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Invalid input",
          message,
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error("route error", { route, requestId, err: err.message });
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details }, requestId },
      { status: err.status }
    );
  }
  logger.error("unhandled route error", {
    route,
    requestId,
    err: err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
  });
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong", requestId } },
    { status: 500 }
  );
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export const aiEnabledForClients = hasAI;

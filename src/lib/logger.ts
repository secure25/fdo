import { env } from "./env";

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const min = LEVELS[(env.logLevel as Level) in LEVELS ? (env.logLevel as Level) : "info"];

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (LEVELS[level] < min) return;
  const rec = { ts: new Date().toISOString(), level, msg, ...ctx };
  const line = env.isProd ? JSON.stringify(rec) : `${rec.ts} ${level.toUpperCase().padEnd(5)} ${msg}${
    ctx && Object.keys(ctx).length ? " " + JSON.stringify(ctx) : ""
  }`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
};

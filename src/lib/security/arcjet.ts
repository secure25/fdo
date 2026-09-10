import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/next";

const arcjetKey = process.env.ARCJET_KEY;

export const aj = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        // Protect against common attacks (SQLi, XSS, user-agent spoofing)
        shield({
          mode: "LIVE",
        }),
        // Detect and block automated bots on sensitive endpoints, allowing search engines
        detectBot({
          mode: "LIVE",
          allow: [
            "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc.
            "CATEGORY:MONITOR",       // Uptime monitors, cron-job.org, etc.
          ],
        }),
        // Sliding window rate limit across distributed lambdas
        slidingWindow({
          mode: "LIVE",
          interval: "1m",
          max: 60,
        }),
      ],
    })
  : null;

/**
 * Protect a request with Arcjet if ARCJET_KEY is configured.
 * If ARCJET_KEY is not set (e.g. in test or dev), this safely passes through.
 */
export async function protectWithArcjet(req: Request) {
  if (!aj) return { ok: true as const, decision: null };

  try {
    const decision = await aj.protect(req);
    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return { ok: false as const, status: 429, message: "Too many requests. Please slow down." };
      }
      if (decision.reason.isBot()) {
        return { ok: false as const, status: 403, message: "Automated access detected." };
      }
      return { ok: false as const, status: 403, message: "Access denied by security policy." };
    }
    return { ok: true as const, decision };
  } catch {
    // If Arcjet is unreachable or errors, fail-open to avoid service outage
    return { ok: true as const, decision: null };
  }
}


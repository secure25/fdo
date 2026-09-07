/** Central env access. Never read process.env elsewhere. */

function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  databaseUrl: str("DATABASE_URL", ""),
  authSecret: str("AUTH_SECRET", "dev-secret-change-me-in-production-9f2c1a"),
  appUrl: str("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  logLevel: str("LOG_LEVEL", "info"),

  ai: {
    apiKey: str("AI_API_KEY", "") || str("OPENAI_API_KEY", ""),
    baseUrl: str("AI_BASE_URL", "https://api.openai.com/v1"),
    model: str("AI_MODEL", "gpt-4o-mini"),
    timeoutMs: int("AI_TIMEOUT_MS", 45_000),
  },

  stripe: {
    secretKey: str("STRIPE_SECRET_KEY", ""),
    webhookSecret: str("STRIPE_WEBHOOK_SECRET", ""),
  },

  paddle: {
    apiKey: str("PADDLE_API_KEY", ""),
    webhookSecret: str("PADDLE_WEBHOOK_SECRET", ""),
    // sandbox | production — switches both the API and checkout domains.
    sandbox: str("PADDLE_ENV", "sandbox").toLowerCase() !== "production",
    prices: {
      MAKER: str("PADDLE_PRICE_MAKER", ""),
      GROWTH: str("PADDLE_PRICE_GROWTH", ""),
      PRO: str("PADDLE_PRICE_PRO", ""),
    },
  },

  reddit: {
    accessToken: str("REDDIT_ACCESS_TOKEN", ""),
  },

  firecrawl: {
    // Optional. Without a key, deep research uses the firecrawl-cli (free keyless
    // tier) installed globally via: npx -y firecrawl-cli@latest init --all --browser
    apiKey: str("FIRECRAWL_API_KEY", ""),
    // Absolute path to the CLI entry (dist/index.js) if auto-detection fails.
    cliPath: str("FIRECRAWL_CLI_PATH", ""),
  },
} as const;

export const hasAI = () => Boolean(env.ai.apiKey);
export const hasStripe = () => Boolean(env.stripe.secretKey);
export const hasPaddle = () => Boolean(env.paddle.apiKey);

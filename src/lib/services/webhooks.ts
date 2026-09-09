import { prisma } from "@/lib/db";
import { jparse } from "@/lib/jsonfield";
import { logger } from "@/lib/logger";

export type WebhookPayload = {
  event: string;
  orgId: string;
  timestamp: string;
  data: Record<string, unknown>;
};

/**
 * Dispatches an outbound webhook event asynchronously.
 * Respects a 10s timeout, logs failures gracefully, and never throws or blocks caller execution.
 */
export async function dispatchOutboundWebhook(
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { orgId, provider: "webhook", status: "CONNECTED" },
    });

    if (!integration || !integration.config) return;

    const config = jparse<{ url?: string }>(integration.config, {});
    const targetUrl = config.url?.trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return;

    const payload: WebhookPayload = {
      event,
      orgId,
      timestamp: new Date().toISOString(),
      data,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FounderDistributionOS-Webhook/1.0",
        "X-Distribution-Event": event,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeout);
        if (res.ok) {
          await prisma.integration.update({
            where: { id: integration.id },
            data: { lastSyncAt: new Date() },
          }).catch(() => undefined);
          logger.info("Outbound webhook delivered", { orgId, event, targetUrl, status: res.status });
        } else {
          logger.warn("Outbound webhook received non-2xx status", { orgId, event, targetUrl, status: res.status });
        }
      })
      .catch((err) => {
        clearTimeout(timeout);
        logger.warn("Outbound webhook dispatch error", {
          orgId,
          event,
          targetUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  } catch (err) {
    logger.warn("Error resolving webhook integration", {
      orgId,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


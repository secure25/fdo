/**
 * Paddle Billing webhook receiver.
 * Register this URL as a Paddle notification destination for
 * transaction.completed + subscription.* events. Signatures are verified
 * with the destination's secret key (PADDLE_WEBHOOK_SECRET) when set.
 */
import { NextResponse } from "next/server";
import { handlePaddleEvent } from "@/lib/billing";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const payload = await req.text(); // raw body — signature is computed over it
    const signature = req.headers.get("paddle-signature");
    const result = await handlePaddleEvent(payload, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    logger.error("paddle webhook error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 400 });
  }
}

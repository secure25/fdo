import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/billing";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    const result = await handleStripeEvent(payload, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    logger.error("stripe webhook error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 400 });
  }
}

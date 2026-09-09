import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processDueJobs } from "@/lib/jobs/queue";
import { HANDLERS } from "@/lib/jobs/scheduler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow serverless function up to 60s for background draining

export async function GET(req: NextRequest) {
  // If CRON_SECRET is configured, enforce authorization
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    // 1. Process due jobs in the queue
    let totalProcessed = 0;
    // Drain up to 15 jobs per cron invocation
    for (let i = 0; i < 15; i++) {
      const count = await processDueJobs(HANDLERS);
      if (count === 0) break;
      totalProcessed += count;
    }

    // 2. Activate scheduled campaigns that reached their scheduled time
    const activated = await prisma.campaign.updateMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    logger.info("[cron] process-jobs executed successfully", {
      jobsProcessed: totalProcessed,
      campaignsActivated: activated.count,
    });

    return NextResponse.json({
      ok: true,
      jobsProcessed: totalProcessed,
      campaignsActivated: activated.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[cron] process-jobs execution failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}


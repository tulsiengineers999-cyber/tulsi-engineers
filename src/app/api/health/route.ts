import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertProductionConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Liveness + readiness probe for the hosting platform. */
export async function GET() {
  const started = Date.now();
  let database = "unknown";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }
  const configProblems = assertProductionConfig();

  const healthy = database === "up" && configProblems.length === 0;
  return NextResponse.json(
    {
      success: healthy,
      data: {
        status: healthy ? "healthy" : "degraded",
        database,
        configProblems,
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
    },
    { status: healthy ? 200 : 503 },
  );
}

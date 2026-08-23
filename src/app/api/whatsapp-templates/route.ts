import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { RecordStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("templates.view");
    const status = new URL(req.url).searchParams.get("status");

    const items = await prisma.whatsappTemplate.findMany({
      where: status ? { status: status as RecordStatus } : undefined,
      orderBy: { name: "asc" },
    });

    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

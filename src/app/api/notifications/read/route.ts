import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

const bodySchema = z.object({ ids: z.array(z.string()).optional() });

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("notifications.view");
    const raw = await req.json().catch(() => ({}));
    const { ids } = bodySchema.parse(raw);

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(ids && ids.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    return ok({ updated: result.count });
  } catch (e) {
    return fail(e);
  }
}

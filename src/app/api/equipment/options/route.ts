import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

/** Lightweight equipment list for dropdowns — not paginated. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("equipment.view");
    const sp = new URL(req.url).searchParams;
    const siteId = sp.get("siteId");
    const customerId = sp.get("customerId");

    const equipment = await prisma.equipment.findMany({
      where: {
        deletedAt: null,
        ...(siteId ? { siteId } : {}),
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, serialNumber: true, siteId: true, customerId: true },
    });

    return ok(equipment);
  } catch (e) {
    return fail(e);
  }
}

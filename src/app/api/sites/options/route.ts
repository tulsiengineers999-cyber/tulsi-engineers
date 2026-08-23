import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

/** Lightweight site list for dropdowns — not paginated. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("sites.view");
    const sp = new URL(req.url).searchParams;
    const customerId = sp.get("customerId");
    const q = (sp.get("q") ?? "").trim();

    const sites = await prisma.site.findMany({
      where: {
        deletedAt: null,
        ...(customerId ? { customerId } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, customerId: true },
    });

    return ok(sites);
  } catch (e) {
    return fail(e);
  }
}

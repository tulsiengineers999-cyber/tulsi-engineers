import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

/** Lightweight active service-type list for dropdowns — not paginated. */
export async function GET() {
  try {
    await requirePermission("jobs.view", "masters.view");

    const items = await prisma.serviceType.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    });

    return ok(items);
  } catch (e) {
    return fail(e);
  }
}

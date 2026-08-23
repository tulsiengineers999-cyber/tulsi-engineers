import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

/** Lightweight customer list for dropdowns — not paginated. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("customers.view");
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { companyName: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { companyName: "asc" },
      take: 200,
      select: { id: true, code: true, companyName: true },
    });

    return ok(customers);
  } catch (e) {
    return fail(e);
  }
}

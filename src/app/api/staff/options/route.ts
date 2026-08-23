import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

/** Lightweight staff list for dropdowns and the field-team directory — not paginated. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("staff.view", "jobs.view");
    const all = new URL(req.url).searchParams.get("all") === "1";

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        ...(all ? {} : { OR: [{ isEngineer: true }, { isTechnician: true }] }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isEngineer: true, isTechnician: true, designation: true },
    });

    return ok(users);
  } catch (e) {
    return fail(e);
  }
}

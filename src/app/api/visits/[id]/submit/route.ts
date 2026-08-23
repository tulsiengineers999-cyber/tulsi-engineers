import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { DOC_STATUS_LABELS } from "@/lib/masters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("visits.edit");
    const { id } = await params;

    const visit = await prisma.siteVisit.findFirst({ where: { id, deletedAt: null } });
    if (!visit) throw Errors.notFound("This site visit could not be found.");
    if (visit.status !== "DRAFT") {
      throw Errors.conflict(`This site visit is already ${DOC_STATUS_LABELS[visit.status]} and cannot be submitted again.`);
    }

    const updated = await prisma.siteVisit.update({
      where: { id },
      data: { status: "SUBMITTED", updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "visits",
      recordId: id, recordLabel: visit.visitNumber,
      oldValue: { status: visit.status }, newValue: { status: "SUBMITTED" },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

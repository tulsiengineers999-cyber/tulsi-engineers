import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { DOC_STATUS_LABELS } from "@/lib/masters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("mom.approve", "mom.edit");
    const { id } = await params;

    const mom = await prisma.mom.findFirst({ where: { id, deletedAt: null } });
    if (!mom) throw Errors.notFound("This MOM could not be found.");
    if (mom.status !== "DRAFT") {
      throw Errors.conflict(`${mom.momNumber} is already ${DOC_STATUS_LABELS[mom.status]} and cannot be submitted again.`);
    }

    const updated = await prisma.mom.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "mom",
      recordId: id, recordLabel: mom.momNumber,
      oldValue: { status: mom.status }, newValue: { status: "SUBMITTED" },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

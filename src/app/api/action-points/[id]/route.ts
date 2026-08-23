import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { momActionPointSchema } from "@/lib/validation/operations";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = momActionPointSchema.pick({
  status: true,
  remarks: true,
  dueDate: true,
  responsiblePerson: true,
  priority: true,
}).partial();

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("mom.edit");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());

    const existing = await prisma.momActionPoint.findFirst({
      where: { id, mom: { deletedAt: null } },
      include: { mom: { select: { id: true, momNumber: true } } },
    });
    if (!existing) throw Errors.notFound("This action point could not be found.");

    const patch: Prisma.MomActionPointUpdateInput = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.completedAt = data.status === "COMPLETED" ? new Date() : null;
    }
    if (data.remarks !== undefined) patch.remarks = data.remarks ?? null;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate ?? null;
    if (data.responsiblePerson !== undefined) patch.responsiblePerson = data.responsiblePerson ?? null;
    if (data.priority !== undefined) patch.priority = data.priority;

    const updated = await prisma.momActionPoint.update({ where: { id }, data: patch });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "mom",
      recordId: existing.mom.id, recordLabel: `${existing.mom.momNumber} — action point`,
      oldValue: { status: existing.status, dueDate: existing.dueDate, priority: existing.priority, responsiblePerson: existing.responsiblePerson },
      newValue: { status: updated.status, dueDate: updated.dueDate, priority: updated.priority, responsiblePerson: updated.responsiblePerson },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

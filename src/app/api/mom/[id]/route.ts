import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { momSchema } from "@/lib/validation/operations";
import { audit, diff } from "@/lib/audit";
import { assertEditable } from "@/lib/services/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("mom.view");
    const { id } = await params;

    const mom = await prisma.mom.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        site: true,
        job: { include: { serviceType: true, equipment: true } },
        participants: { orderBy: { createdAt: "asc" } },
        actionPoints: { orderBy: { sequence: "asc" }, include: { generatedJob: { select: { id: true, jobNumber: true } } } },
        photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!mom) throw Errors.notFound("This MOM could not be found.");

    return ok(mom);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("mom.edit");
    const { id } = await params;

    // Client-confirmed MOMs are locked — this throws a friendly "use Revise" error.
    await assertEditable("MOM", id);

    const data = momSchema.parse(await req.json());

    const before = await prisma.mom.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This MOM could not be found.");

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected service job could not be found.");

    if (data.siteVisitId) {
      const visit = await prisma.siteVisit.findFirst({ where: { id: data.siteVisitId, deletedAt: null } });
      if (!visit) throw Errors.notFound("The selected site visit could not be found.");
      if (visit.jobId !== job.id) {
        throw Errors.validation("The selected site visit does not belong to the selected job.");
      }
    }

    const { participants, actionPoints, ...momFields } = data;

    const mom = await prisma.$transaction(async (tx) => {
      const updated = await tx.mom.update({
        where: { id },
        data: {
          ...momFields,
          customerId: job.customerId,
          siteId: job.siteId,
          updatedById: user.id,
        },
      });

      await tx.momParticipant.deleteMany({ where: { momId: id } });
      if (participants.length) {
        await tx.momParticipant.createMany({ data: participants.map((p) => ({ ...p, momId: id })) });
      }

      const existingPoints = await tx.momActionPoint.findMany({
        where: { momId: id },
        include: { generatedJob: { select: { id: true, jobNumber: true } } },
      });
      const keepIds = new Set(actionPoints.filter((a) => a.id).map((a) => a.id));

      for (const existing of existingPoints) {
        if (keepIds.has(existing.id)) continue;
        if (existing.generatedJob) {
          throw Errors.conflict(
            `The action point "${existing.actionPoint.slice(0, 60)}" already created service job ${existing.generatedJob.jobNumber} and cannot be removed. Keep it in this MOM, or cancel the job first.`,
          );
        }
        await tx.momActionPoint.delete({ where: { id: existing.id } });
      }

      const existingIds = new Set(existingPoints.map((e) => e.id));
      for (const [idx, ap] of actionPoints.entries()) {
        const { id: apId, ...apData } = ap;
        if (apId && existingIds.has(apId)) {
          await tx.momActionPoint.update({ where: { id: apId }, data: { ...apData, sequence: idx + 1 } });
        } else {
          await tx.momActionPoint.create({ data: { ...apData, sequence: idx + 1, momId: id } });
        }
      }

      return updated;
    });

    const changes = diff(before as unknown as Record<string, unknown>, momFields as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "mom",
        recordId: id, recordLabel: mom.momNumber, oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(mom);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("mom.delete");
    const { id } = await params;

    const mom = await prisma.mom.findFirst({ where: { id, deletedAt: null } });
    if (!mom) throw Errors.notFound("This MOM could not be found.");
    if (mom.status === "CLIENT_CONFIRMED") {
      throw Errors.conflict(`${mom.momNumber} has been confirmed by the client and cannot be deleted.`);
    }

    await prisma.mom.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "mom",
      recordId: id, recordLabel: mom.momNumber,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

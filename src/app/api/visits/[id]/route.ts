import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { visitSchema } from "@/lib/validation/operations";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("visits.view");
    const { id } = await params;

    const visit = await prisma.siteVisit.findFirst({
      where: { id, deletedAt: null },
      include: {
        job: { select: { id: true, jobNumber: true, status: true, serviceType: { select: { name: true } } } },
        customer: true,
        site: true,
        engineer: { select: { id: true, name: true, mobile: true, email: true } },
        photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!visit) throw Errors.notFound("This site visit could not be found.");

    return ok(visit);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("visits.edit");
    const { id } = await params;
    const data = visitSchema.parse(await req.json());

    const before = await prisma.siteVisit.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This site visit could not be found.");

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const visit = await prisma.siteVisit.update({
      where: { id },
      data: { ...data, customerId: job.customerId, siteId: job.siteId, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "visits",
        recordId: id, recordLabel: visit.visitNumber, oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(visit);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("visits.delete");
    const { id } = await params;

    const visit = await prisma.siteVisit.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { moms: true } } },
    });
    if (!visit) throw Errors.notFound("This site visit could not be found.");
    if (visit._count.moms > 0) {
      throw Errors.conflict(
        `${visit.visitNumber} has ${visit._count.moms} MOM record(s) linked to it and cannot be deleted.`,
      );
    }

    await prisma.siteVisit.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "visits",
      recordId: id, recordLabel: visit.visitNumber,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

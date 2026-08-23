import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { jobSchema } from "@/lib/validation/operations";
import { audit, diff } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("jobs.view");
    const { id } = await params;

    const job = await prisma.serviceJob.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        site: true,
        equipment: true,
        serviceType: true,
        engineer: { select: { id: true, name: true, mobile: true, email: true, designation: true } },
        technician: { select: { id: true, name: true, mobile: true, email: true, designation: true } },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        visits: { where: { deletedAt: null }, orderBy: { visitDate: "desc" } },
        moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" } },
        dailyReports: { where: { deletedAt: null }, orderBy: { reportDate: "desc" } },
        finalReports: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        statusHistory: { orderBy: { createdAt: "desc" } },
        _count: { select: { photos: true } },
      },
    });
    if (!job) throw Errors.notFound("This service job could not be found.");

    const changedByIds = [...new Set(job.statusHistory.map((h) => h.changedById).filter(Boolean))] as string[];
    const changedByUsers = changedByIds.length
      ? await prisma.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, name: true } })
      : [];
    const changedByMap = Object.fromEntries(changedByUsers.map((u) => [u.id, u.name]));
    const statusHistory = job.statusHistory.map((h) => ({
      ...h,
      changedByName: h.changedById ? (changedByMap[h.changedById] ?? null) : null,
    }));

    return ok({ ...job, statusHistory });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("jobs.edit");
    const { id } = await params;
    const data = jobSchema.parse(await req.json());

    const before = await prisma.serviceJob.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This service job could not be found.");

    const site = await prisma.site.findFirst({ where: { id: data.siteId, deletedAt: null } });
    if (!site) throw Errors.notFound("The selected site could not be found.");
    if (site.customerId !== data.customerId) {
      throw Errors.validation("The selected site does not belong to the selected customer.");
    }
    if (data.equipmentId) {
      const equipment = await prisma.equipment.findFirst({ where: { id: data.equipmentId, deletedAt: null } });
      if (!equipment) throw Errors.notFound("The selected equipment could not be found.");
    }

    const job = await prisma.serviceJob.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "jobs",
        recordId: id, recordLabel: job.jobNumber, oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(job);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("jobs.delete");
    const { id } = await params;

    const job = await prisma.serviceJob.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { visits: true, moms: true, dailyReports: true, finalReports: true } } },
    });
    if (!job) throw Errors.notFound("This service job could not be found.");

    const { visits, moms, dailyReports, finalReports } = job._count;
    if (visits > 0 || moms > 0 || dailyReports > 0 || finalReports > 0) {
      throw Errors.conflict(
        `${job.jobNumber} has ${visits} site visit(s), ${moms} MOM(s), ${dailyReports} daily report(s) and ${finalReports} final report(s) linked to it and cannot be deleted. Cancel the job instead.`,
      );
    }

    await prisma.serviceJob.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "jobs",
      recordId: id, recordLabel: job.jobNumber,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

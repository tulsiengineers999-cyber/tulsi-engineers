import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { finalReportSchema } from "@/lib/validation/operations";
import { audit, diff } from "@/lib/audit";
import { assertEditable } from "@/lib/services/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("final_reports.view");
    const { id } = await params;

    const report = await prisma.finalServiceReport.findFirst({
      where: { id, deletedAt: null },
      include: {
        job: {
          include: {
            serviceType: true,
            equipment: true,
            engineer: { select: { id: true, name: true } },
            moms: { where: { deletedAt: null }, orderBy: { meetingDate: "desc" }, select: { id: true, momNumber: true, meetingDate: true, status: true } },
            visits: { where: { deletedAt: null }, orderBy: { visitDate: "desc" }, select: { id: true, visitNumber: true, visitDate: true, status: true } },
            dailyReports: {
              where: { deletedAt: null },
              orderBy: { reportDate: "asc" },
              select: {
                id: true, reportNumber: true, reportDate: true, workHours: true, progressPercent: true,
                workPerformed: true, status: true,
              },
            },
          },
        },
        customer: true,
        site: true,
        photos: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
      },
    });
    if (!report) throw Errors.notFound("This final service report could not be found.");

    return ok(report);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("final_reports.edit");
    const { id } = await params;
    const data = finalReportSchema.parse(await req.json());

    await assertEditable("FINAL_SERVICE_REPORT", id);

    const before = await prisma.finalServiceReport.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This final service report could not be found.");

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const report = await prisma.finalServiceReport.update({
      where: { id },
      data: { ...data, customerId: job.customerId, siteId: job.siteId, updatedById: user.id },
    });

    const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "final_reports",
        recordId: id, recordLabel: report.reportNumber, oldValue: changes.oldValue, newValue: changes.newValue,
      });
    }

    return ok(report);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("final_reports.delete");
    const { id } = await params;

    const report = await prisma.finalServiceReport.findFirst({ where: { id, deletedAt: null } });
    if (!report) throw Errors.notFound("This final service report could not be found.");
    if (report.status === "CLIENT_CONFIRMED") {
      throw Errors.conflict(
        `${report.reportNumber} has been confirmed by the client and cannot be deleted. Use “Revise” if changes are required.`,
      );
    }

    await prisma.finalServiceReport.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "final_reports",
      recordId: id, recordLabel: report.reportNumber,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

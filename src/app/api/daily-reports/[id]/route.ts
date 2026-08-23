import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { dailyReportSchema } from "@/lib/validation/operations";
import { audit, diff } from "@/lib/audit";
import { assertEditable } from "@/lib/services/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("daily_reports.view");
    const { id } = await params;

    const report = await prisma.dailyWorkReport.findFirst({
      where: { id, deletedAt: null },
      include: {
        job: { include: { customer: true, site: true, serviceType: true, equipment: true } },
        engineer: { select: { id: true, name: true, mobile: true, email: true, designation: true } },
        materials: { orderBy: { createdAt: "asc" } },
        spares: { orderBy: { createdAt: "asc" } },
        photos: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
      },
    });
    if (!report) throw Errors.notFound("This daily work report could not be found.");

    return ok(report);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("daily_reports.edit");
    const { id } = await params;
    const data = dailyReportSchema.parse(await req.json());

    await assertEditable("DAILY_WORK_REPORT", id);

    const before = await prisma.dailyWorkReport.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Errors.notFound("This daily work report could not be found.");

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const { materials, spares, ...rest } = data;

    const report = await prisma.$transaction(async (tx) => {
      await tx.workMaterial.deleteMany({ where: { dailyReportId: id } });
      await tx.workSpare.deleteMany({ where: { dailyReportId: id } });
      return tx.dailyWorkReport.update({
        where: { id },
        data: {
          ...rest,
          updatedById: user.id,
          materials: {
            create: materials.map((m) => ({
              name: m.name, specification: m.specification, quantity: m.quantity, unit: m.unit, remarks: m.remarks,
            })),
          },
          spares: {
            create: spares.map((s) => ({
              name: s.name, partNumber: s.partNumber, make: s.make, quantity: s.quantity, unit: s.unit, remarks: s.remarks,
            })),
          },
        },
      });
    });

    const changes = diff(before as unknown as Record<string, unknown>, rest as Record<string, unknown>);
    if (changes.changed) {
      await audit({
        userId: user.id, userName: user.name, action: "UPDATE", module: "daily_reports",
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
    const user = await requirePermission("daily_reports.delete");
    const { id } = await params;

    const report = await prisma.dailyWorkReport.findFirst({ where: { id, deletedAt: null } });
    if (!report) throw Errors.notFound("This daily work report could not be found.");
    if (report.status === "CLIENT_CONFIRMED") {
      throw Errors.conflict(
        `${report.reportNumber} has been confirmed by the client and cannot be deleted. Use “Revise” if changes are required.`,
      );
    }

    await prisma.dailyWorkReport.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit({
      userId: user.id, userName: user.name, action: "DELETE", module: "daily_reports",
      recordId: id, recordLabel: report.reportNumber,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

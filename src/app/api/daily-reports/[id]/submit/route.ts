import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { DOC_STATUS_LABELS } from "@/lib/masters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("daily_reports.edit");
    const { id } = await params;

    const report = await prisma.dailyWorkReport.findFirst({ where: { id, deletedAt: null } });
    if (!report) throw Errors.notFound("This daily work report could not be found.");
    if (report.status !== "DRAFT") {
      throw Errors.conflict(`${report.reportNumber} is already ${DOC_STATUS_LABELS[report.status]} and cannot be submitted again.`);
    }

    const updated = await prisma.dailyWorkReport.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "daily_reports",
      recordId: id, recordLabel: report.reportNumber,
      oldValue: { status: report.status }, newValue: { status: "SUBMITTED" },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

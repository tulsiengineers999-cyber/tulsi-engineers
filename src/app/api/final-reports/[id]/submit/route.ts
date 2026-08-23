import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { DOC_STATUS_LABELS, JOB_STATUS_FLOW } from "@/lib/masters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("final_reports.edit");
    const { id } = await params;

    const report = await prisma.finalServiceReport.findFirst({
      where: { id, deletedAt: null },
      include: { job: true },
    });
    if (!report) throw Errors.notFound("This final service report could not be found.");
    if (report.status !== "DRAFT") {
      throw Errors.conflict(`${report.reportNumber} is already ${DOC_STATUS_LABELS[report.status]} and cannot be submitted again.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.finalServiceReport.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date(), updatedById: user.id },
      });

      const job = report.job;
      const currentIdx = JOB_STATUS_FLOW.indexOf(job.status);
      const targetIdx = JOB_STATUS_FLOW.indexOf("CONFIRMATION_PENDING");
      if (currentIdx !== -1 && currentIdx < targetIdx) {
        await tx.serviceJob.update({ where: { id: job.id }, data: { status: "CONFIRMATION_PENDING", updatedById: user.id } });
        await tx.jobStatusHistory.create({
          data: {
            jobId: job.id, fromStatus: job.status, toStatus: "CONFIRMATION_PENDING",
            changedById: user.id, remarks: `Final service report ${report.reportNumber} submitted`,
          },
        });
      }

      return saved;
    });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "final_reports",
      recordId: id, recordLabel: report.reportNumber,
      oldValue: { status: report.status }, newValue: { status: "SUBMITTED" },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

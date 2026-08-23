import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { jobStatusSchema } from "@/lib/validation/operations";
import { audit } from "@/lib/audit";
import { JOB_STATUS_FLOW, JOB_STATUS_LABELS } from "@/lib/masters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("jobs.edit");
    const { id } = await params;
    const data = jobStatusSchema.parse(await req.json());

    const job = await prisma.serviceJob.findFirst({ where: { id, deletedAt: null } });
    if (!job) throw Errors.notFound("This service job could not be found.");

    const from = job.status;
    const to = data.status;

    if (to === from) {
      throw Errors.conflict(`This job is already ${JOB_STATUS_LABELS[from]}.`);
    }

    if (to === "CANCELLED") {
      if (from === "COMPLETED" || from === "CLOSED" || from === "CANCELLED") {
        throw Errors.conflict("A completed, closed or already cancelled job cannot be cancelled.");
      }
    } else if (to === "CLOSED") {
      if (from !== "COMPLETED") {
        throw Errors.conflict("A job can only be closed after it has been marked Completed.");
      }
    } else {
      if (from === "CANCELLED" || from === "CLOSED") {
        throw Errors.conflict(`This job is ${JOB_STATUS_LABELS[from]} and its status cannot be changed further.`);
      }
      const fromIdx = JOB_STATUS_FLOW.indexOf(from);
      const toIdx = JOB_STATUS_FLOW.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) {
        throw Errors.conflict("That status change is not valid for this job.");
      }
      if (toIdx < fromIdx - 1) {
        throw Errors.conflict(
          `A job cannot jump backward from ${JOB_STATUS_LABELS[from]} to ${JOB_STATUS_LABELS[to]}. You can only move it back one step at a time.`,
        );
      }
    }

    const job2 = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceJob.update({
        where: { id },
        data: {
          status: to,
          progressPercent: data.progressPercent ?? job.progressPercent,
          completedAt: to === "COMPLETED" ? new Date() : job.completedAt,
          updatedById: user.id,
        },
      });
      await tx.jobStatusHistory.create({
        data: { jobId: id, fromStatus: from, toStatus: to, changedById: user.id, remarks: data.remarks },
      });
      return updated;
    });

    await audit({
      userId: user.id, userName: user.name, action: "STATUS_CHANGE", module: "jobs",
      recordId: id, recordLabel: job.jobNumber,
      oldValue: { status: from }, newValue: { status: to, remarks: data.remarks },
    });

    return ok(job2);
  } catch (e) {
    return fail(e);
  }
}

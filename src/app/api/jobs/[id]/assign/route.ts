import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { assignSchema } from "@/lib/validation/operations";
import { audit } from "@/lib/audit";
import { sendTemplatedEmail } from "@/lib/services/email";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("jobs.assign");
    const { id } = await params;
    const data = assignSchema.parse(await req.json());

    if (!data.engineerId && !data.technicianId) {
      throw Errors.validation("Select an engineer or a technician to assign this job to.");
    }

    const job = await prisma.serviceJob.findFirst({
      where: { id, deletedAt: null },
      include: { customer: { select: { companyName: true } }, site: { select: { name: true } } },
    });
    if (!job) throw Errors.notFound("This service job could not be found.");

    const assigneeIds = [data.engineerId, data.technicianId].filter((v): v is string => Boolean(v));
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({ where: { id: { in: assigneeIds }, deletedAt: null }, select: { id: true, name: true, email: true } })
      : [];
    if (assignees.length !== assigneeIds.length) {
      throw Errors.notFound("One of the selected engineers or technicians could not be found.");
    }

    const nextStatus = job.status === "NEW" ? "ASSIGNED" : job.status;

    await prisma.$transaction(async (tx) => {
      await tx.jobAssignment.updateMany({
        where: { jobId: id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      const rows: { jobId: string; userId: string; role: string; assignedById: string; remarks?: string }[] = [];
      if (data.engineerId) rows.push({ jobId: id, userId: data.engineerId, role: "ENGINEER", assignedById: user.id, remarks: data.remarks });
      if (data.technicianId) rows.push({ jobId: id, userId: data.technicianId, role: "TECHNICIAN", assignedById: user.id, remarks: data.remarks });
      if (rows.length) await tx.jobAssignment.createMany({ data: rows });

      await tx.serviceJob.update({
        where: { id },
        data: {
          engineerId: data.engineerId ?? job.engineerId,
          technicianId: data.technicianId ?? job.technicianId,
          plannedVisitDate: data.plannedVisitDate ?? job.plannedVisitDate,
          status: nextStatus,
          updatedById: user.id,
        },
      });

      if (nextStatus !== job.status) {
        await tx.jobStatusHistory.create({
          data: { jobId: id, fromStatus: job.status, toStatus: nextStatus, changedById: user.id, remarks: "Job assigned" },
        });
      }

      if (assigneeIds.length) {
        await tx.notification.createMany({
          data: assigneeIds.map((uid) => ({
            userId: uid,
            type: "JOB_ASSIGNED",
            title: `Job ${job.jobNumber} assigned to you`,
            message: `You have been assigned to ${job.jobNumber} at ${job.site.name}, ${job.customer.companyName}.`,
            link: `/jobs/${id}`,
            recordId: id,
          })),
        });
      }
    });

    if (data.notify) {
      for (const assignee of assignees) {
        if (!assignee.email) continue;
        await sendTemplatedEmail({
          templateCode: "JOB_ASSIGNED",
          to: assignee.email,
          variables: {
            assignee_name: assignee.name,
            job_number: job.jobNumber,
            customer_name: job.customer.companyName,
            site_name: job.site.name,
          },
          recordId: id,
          recordNumber: job.jobNumber,
          customerId: job.customerId,
          sentById: user.id,
        });
      }
    }

    await audit({
      userId: user.id, userName: user.name, action: "UPDATE", module: "jobs",
      recordId: id, recordLabel: job.jobNumber,
      newValue: { engineerId: data.engineerId, technicianId: data.technicianId, plannedVisitDate: data.plannedVisitDate },
      description: "Job assigned",
    });

    const updated = await prisma.serviceJob.findUnique({ where: { id } });
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

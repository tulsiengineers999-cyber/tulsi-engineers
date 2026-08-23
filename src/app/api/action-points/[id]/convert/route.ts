import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { dateish } from "@/lib/validation/masters";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const convertSchema = z.object({
  serviceTypeId: z.string().min(1, "Select the type of service this job is for"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  plannedVisitDate: dateish,
  engineerId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  targetCompletionDate: dateish,
});

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requirePermission("jobs.create");
    const { id } = await params;
    const data = convertSchema.parse(await req.json());

    const actionPoint = await prisma.momActionPoint.findFirst({
      where: { id, mom: { deletedAt: null } },
      select: {
        id: true,
        actionPoint: true,
        generatedJob: { select: { id: true, jobNumber: true } },
        mom: {
          select: {
            momNumber: true,
            job: { select: { id: true, customerId: true, siteId: true, equipmentId: true, deletedAt: true } },
          },
        },
      },
    });
    if (!actionPoint) throw Errors.notFound("This action point could not be found.");
    if (actionPoint.generatedJob) {
      throw Errors.conflict(`This action point already created service job ${actionPoint.generatedJob.jobNumber}.`);
    }
    if (!actionPoint.mom.job || actionPoint.mom.job.deletedAt) {
      throw Errors.conflict("The service job linked to this MOM could not be found.");
    }

    const serviceType = await prisma.serviceType.findFirst({ where: { id: data.serviceTypeId, deletedAt: null } });
    if (!serviceType) throw Errors.notFound("The selected service type could not be found.");

    if (data.engineerId) {
      const engineer = await prisma.user.findFirst({ where: { id: data.engineerId, deletedAt: null } });
      if (!engineer) throw Errors.notFound("The selected engineer could not be found.");
    }

    const jobNumber = await nextNumber("JOB");
    const sourceJob = actionPoint.mom.job;

    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.serviceJob.create({
        data: {
          jobNumber,
          customerId: sourceJob.customerId,
          siteId: sourceJob.siteId,
          equipmentId: sourceJob.equipmentId,
          serviceTypeId: data.serviceTypeId,
          priority: data.priority,
          plannedVisitDate: data.plannedVisitDate,
          targetCompletionDate: data.targetCompletionDate,
          engineerId: data.engineerId,
          jobDescription: actionPoint.actionPoint,
          sourceActionPointId: actionPoint.id,
          createdById: user.id,
          updatedById: user.id,
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: newJob.id, fromStatus: null, toStatus: "NEW", changedById: user.id,
          remarks: `Created from action point in MOM ${actionPoint.mom.momNumber}`,
        },
      });

      await tx.momActionPoint.update({ where: { id: actionPoint.id }, data: { status: "IN_PROGRESS" } });

      return newJob;
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "jobs",
      recordId: job.id, recordLabel: job.jobNumber,
      description: `Converted from an action point in MOM ${actionPoint.mom.momNumber}`,
      newValue: data,
    });

    return created(job);
  } catch (e) {
    return fail(e);
  }
}

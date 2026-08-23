import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission, scopeToOwnJobs } from "@/lib/guard";
import { jobSchema } from "@/lib/validation/operations";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma, JobStatus, Priority } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("jobs.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const status = params.get("status");
    const priority = params.get("priority");
    const customerId = params.get("customerId");
    const siteId = params.get("siteId");
    const engineerId = params.get("engineerId");
    const serviceTypeId = params.get("serviceTypeId");
    const from = params.get("from");
    const to = params.get("to");
    const overdue = params.get("overdue") === "1";
    const amc = params.get("amc") === "1";

    const and: Prisma.ServiceJobWhereInput[] = [{ deletedAt: null }];

    const scope = scopeToOwnJobs(user);
    if (Object.keys(scope).length) and.push(scope);

    if (status) {
      const statuses = status.split(",").filter(Boolean) as JobStatus[];
      and.push(statuses.length > 1 ? { status: { in: statuses } } : { status: statuses[0] });
    }
    if (priority) and.push({ priority: priority as Priority });
    if (customerId) and.push({ customerId });
    if (siteId) and.push({ siteId });
    if (engineerId) and.push({ engineerId });
    if (serviceTypeId) and.push({ serviceTypeId });
    if (from || to) {
      and.push({
        plannedVisitDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (overdue) {
      and.push({
        plannedVisitDate: { lt: new Date() },
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
      });
    }
    if (amc) and.push({ equipment: { amcStatus: "UNDER_AMC" } });
    if (q) {
      and.push({
        OR: [
          { jobNumber: { contains: q, mode: "insensitive" } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
          { site: { name: { contains: q, mode: "insensitive" } } },
          { problemDescription: { contains: q, mode: "insensitive" } },
          { engineer: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.ServiceJobWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.serviceJob.findMany({
        where,
        skip,
        take,
        orderBy: [{ plannedVisitDate: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          jobNumber: true,
          priority: true,
          status: true,
          requestDate: true,
          plannedVisitDate: true,
          targetCompletionDate: true,
          progressPercent: true,
          customer: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
          serviceType: { select: { id: true, name: true } },
          engineer: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } },
        },
      }),
      prisma.serviceJob.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("jobs.create");
    const data = jobSchema.parse(await req.json());

    const site = await prisma.site.findFirst({ where: { id: data.siteId, deletedAt: null } });
    if (!site) throw Errors.notFound("The selected site could not be found.");
    if (site.customerId !== data.customerId) {
      throw Errors.validation("The selected site does not belong to the selected customer.");
    }
    if (data.equipmentId) {
      const equipment = await prisma.equipment.findFirst({ where: { id: data.equipmentId, deletedAt: null } });
      if (!equipment) throw Errors.notFound("The selected equipment could not be found.");
    }

    const jobNumber = await nextNumber("JOB");

    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.serviceJob.create({
        data: { ...data, jobNumber, createdById: user.id, updatedById: user.id },
      });
      await tx.jobStatusHistory.create({
        data: { jobId: newJob.id, fromStatus: null, toStatus: "NEW", changedById: user.id },
      });
      return newJob;
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "jobs",
      recordId: job.id, recordLabel: job.jobNumber, newValue: data,
    });

    return created(job);
  } catch (e) {
    return fail(e);
  }
}

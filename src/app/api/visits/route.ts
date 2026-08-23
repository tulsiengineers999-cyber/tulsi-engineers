import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { visitSchema } from "@/lib/validation/operations";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma, DocWorkflowStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("visits.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const jobId = params.get("jobId");
    const customerId = params.get("customerId");
    const siteId = params.get("siteId");
    const engineerId = params.get("engineerId");
    const status = params.get("status");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.SiteVisitWhereInput[] = [{ deletedAt: null }];
    if (jobId) and.push({ jobId });
    if (customerId) and.push({ customerId });
    if (siteId) and.push({ siteId });
    if (engineerId) and.push({ engineerId });
    if (status) and.push({ status: status as DocWorkflowStatus });
    if (from || to) {
      and.push({
        visitDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { visitNumber: { contains: q, mode: "insensitive" } },
          { job: { jobNumber: { contains: q, mode: "insensitive" } } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
          { site: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.SiteVisitWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.siteVisit.findMany({
        where,
        skip,
        take,
        orderBy: { visitDate: "desc" },
        select: {
          id: true,
          visitNumber: true,
          visitDate: true,
          status: true,
          job: { select: { id: true, jobNumber: true } },
          customer: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
          engineer: { select: { id: true, name: true } },
        },
      }),
      prisma.siteVisit.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("visits.create");
    const data = visitSchema.parse(await req.json());

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const visitNumber = await nextNumber("SV");

    const visit = await prisma.$transaction(async (tx) => {
      const newVisit = await tx.siteVisit.create({
        data: {
          ...data,
          visitNumber,
          customerId: job.customerId,
          siteId: job.siteId,
          createdById: user.id,
          updatedById: user.id,
        },
      });

      if (job.status === "NEW" || job.status === "ASSIGNED") {
        await tx.serviceJob.update({ where: { id: job.id }, data: { status: "SITE_VISIT", updatedById: user.id } });
        await tx.jobStatusHistory.create({
          data: { jobId: job.id, fromStatus: job.status, toStatus: "SITE_VISIT", changedById: user.id, remarks: `Site visit ${visitNumber} created` },
        });
      }

      return newVisit;
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "visits",
      recordId: visit.id, recordLabel: visit.visitNumber, newValue: data,
    });

    return created(visit);
  } catch (e) {
    return fail(e);
  }
}

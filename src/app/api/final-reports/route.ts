import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { finalReportSchema } from "@/lib/validation/operations";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma, DocWorkflowStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("final_reports.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const jobId = params.get("jobId");
    const customerId = params.get("customerId");
    const status = params.get("status");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.FinalServiceReportWhereInput[] = [{ deletedAt: null }];
    if (jobId) and.push({ jobId });
    if (customerId) and.push({ customerId });
    if (status) and.push({ status: status as DocWorkflowStatus });
    if (from || to) {
      and.push({
        completionDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { reportNumber: { contains: q, mode: "insensitive" } },
          { job: { jobNumber: { contains: q, mode: "insensitive" } } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
          { site: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.FinalServiceReportWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.finalServiceReport.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reportNumber: true,
          completionDate: true,
          status: true,
          job: { select: { id: true, jobNumber: true } },
          customer: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
        },
      }),
      prisma.finalServiceReport.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("final_reports.create");
    const data = finalReportSchema.parse(await req.json());

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const reportNumber = await nextNumber("FSR");

    const report = await prisma.finalServiceReport.create({
      data: {
        ...data,
        reportNumber,
        customerId: job.customerId,
        siteId: job.siteId,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "final_reports",
      recordId: report.id, recordLabel: report.reportNumber, newValue: data,
    });

    return created(report);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission, scopeToOwnJobs } from "@/lib/guard";
import { dailyReportSchema } from "@/lib/validation/operations";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { JOB_STATUS_FLOW } from "@/lib/masters";
import type { Prisma, DocWorkflowStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("daily_reports.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const jobId = params.get("jobId");
    const engineerId = params.get("engineerId");
    const status = params.get("status");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.DailyWorkReportWhereInput[] = [{ deletedAt: null }];

    const scope = scopeToOwnJobs(user);
    if (Object.keys(scope).length) and.push({ job: scope });

    if (jobId) and.push({ jobId });
    if (engineerId) and.push({ engineerId });
    if (status) and.push({ status: status as DocWorkflowStatus });
    if (from || to) {
      and.push({
        reportDate: {
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
          { job: { customer: { companyName: { contains: q, mode: "insensitive" } } } },
          { job: { site: { name: { contains: q, mode: "insensitive" } } } },
          { engineer: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.DailyWorkReportWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.dailyWorkReport.findMany({
        where,
        skip,
        take,
        orderBy: { reportDate: "desc" },
        select: {
          id: true,
          reportNumber: true,
          reportDate: true,
          status: true,
          workHours: true,
          progressPercent: true,
          job: {
            select: {
              id: true, jobNumber: true,
              customer: { select: { id: true, companyName: true } },
              site: { select: { id: true, name: true } },
            },
          },
          engineer: { select: { id: true, name: true } },
          _count: { select: { photos: true } },
        },
      }),
      prisma.dailyWorkReport.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("daily_reports.create");
    const data = dailyReportSchema.parse(await req.json());

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected job could not be found.");

    const reportNumber = await nextNumber("DWR");
    const { materials, spares, ...rest } = data;

    const report = await prisma.$transaction(async (tx) => {
      const newReport = await tx.dailyWorkReport.create({
        data: {
          ...rest,
          reportNumber,
          createdById: user.id,
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

      // A daily work report means the job is actively being worked — advance
      // the status if it hasn't reached "Work In Progress" yet.
      const currentIdx = JOB_STATUS_FLOW.indexOf(job.status);
      const targetIdx = JOB_STATUS_FLOW.indexOf("WORK_IN_PROGRESS");
      if (currentIdx !== -1 && currentIdx < targetIdx) {
        await tx.serviceJob.update({ where: { id: job.id }, data: { status: "WORK_IN_PROGRESS", updatedById: user.id } });
        await tx.jobStatusHistory.create({
          data: {
            jobId: job.id, fromStatus: job.status, toStatus: "WORK_IN_PROGRESS",
            changedById: user.id, remarks: `Daily work report ${reportNumber} recorded`,
          },
        });
      }

      return newReport;
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "daily_reports",
      recordId: report.id, recordLabel: report.reportNumber, newValue: data,
    });

    return created(report);
  } catch (e) {
    return fail(e);
  }
}

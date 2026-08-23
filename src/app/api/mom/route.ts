import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { momSchema } from "@/lib/validation/operations";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { JOB_STATUS_FLOW } from "@/lib/masters";
import type { Prisma, DocWorkflowStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("mom.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const jobId = params.get("jobId");
    const customerId = params.get("customerId");
    const siteId = params.get("siteId");
    const status = params.get("status");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.MomWhereInput[] = [{ deletedAt: null }];
    if (jobId) and.push({ jobId });
    if (customerId) and.push({ customerId });
    if (siteId) and.push({ siteId });
    if (status) and.push({ status: status as DocWorkflowStatus });
    if (from || to) {
      and.push({
        meetingDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { momNumber: { contains: q, mode: "insensitive" } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
          { site: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.MomWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.mom.findMany({
        where,
        skip,
        take,
        orderBy: { meetingDate: "desc" },
        select: {
          id: true,
          momNumber: true,
          meetingDate: true,
          meetingTime: true,
          status: true,
          version: true,
          customer: { select: { id: true, companyName: true } },
          site: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true } },
          _count: { select: { actionPoints: true, photos: true } },
        },
      }),
      prisma.mom.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("mom.create");
    const data = momSchema.parse(await req.json());

    const job = await prisma.serviceJob.findFirst({ where: { id: data.jobId, deletedAt: null } });
    if (!job) throw Errors.notFound("The selected service job could not be found.");

    if (data.siteVisitId) {
      const visit = await prisma.siteVisit.findFirst({ where: { id: data.siteVisitId, deletedAt: null } });
      if (!visit) throw Errors.notFound("The selected site visit could not be found.");
      if (visit.jobId !== job.id) {
        throw Errors.validation("The selected site visit does not belong to the selected job.");
      }
    }

    const momNumber = await nextNumber("MOM");
    const { participants, actionPoints, ...momFields } = data;

    const mom = await prisma.$transaction(async (tx) => {
      const newMom = await tx.mom.create({
        data: {
          ...momFields,
          momNumber,
          customerId: job.customerId,
          siteId: job.siteId,
          createdById: user.id,
          updatedById: user.id,
          participants: { create: participants },
          actionPoints: {
            create: actionPoints.map((a, idx) => {
              const { id: _unusedId, ...rest } = a;
              void _unusedId;
              return { ...rest, sequence: idx + 1 };
            }),
          },
        },
      });

      const momCreatedIdx = JOB_STATUS_FLOW.indexOf("MOM_CREATED");
      const jobIdx = JOB_STATUS_FLOW.indexOf(job.status);
      if (jobIdx !== -1 && jobIdx < momCreatedIdx) {
        await tx.serviceJob.update({ where: { id: job.id }, data: { status: "MOM_CREATED", updatedById: user.id } });
        await tx.jobStatusHistory.create({
          data: { jobId: job.id, fromStatus: job.status, toStatus: "MOM_CREATED", changedById: user.id, remarks: `MOM ${momNumber} created` },
        });
      }

      return newMom;
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "mom",
      recordId: mom.id, recordLabel: mom.momNumber, newValue: data,
    });

    return created(mom);
  } catch (e) {
    return fail(e);
  }
}

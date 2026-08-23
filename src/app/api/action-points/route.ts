import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { ActionPointStatus, Prisma, ResponsibleParty } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("mom.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const status = params.get("status");
    const responsibleParty = params.get("responsibleParty");
    const momId = params.get("momId");
    const overdue = params.get("overdue") === "1";
    const dueFrom = params.get("dueFrom");
    const dueTo = params.get("dueTo");

    const and: Prisma.MomActionPointWhereInput[] = [{ mom: { deletedAt: null } }];
    if (status) and.push({ status: status as ActionPointStatus });
    if (responsibleParty) and.push({ responsibleParty: responsibleParty as ResponsibleParty });
    if (momId) and.push({ momId });
    if (overdue) {
      and.push({ dueDate: { lt: new Date() }, status: { notIn: ["COMPLETED", "CANCELLED"] } });
    }
    if (dueFrom || dueTo) {
      and.push({
        dueDate: {
          ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
          ...(dueTo ? { lte: new Date(`${dueTo}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { actionPoint: { contains: q, mode: "insensitive" } },
          { responsiblePerson: { contains: q, mode: "insensitive" } },
          { mom: { momNumber: { contains: q, mode: "insensitive" } } },
          { mom: { customer: { companyName: { contains: q, mode: "insensitive" } } } },
          { mom: { site: { name: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }

    const where: Prisma.MomActionPointWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      prisma.momActionPoint.findMany({
        where,
        skip,
        take,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          mom: {
            select: {
              id: true, momNumber: true,
              customer: { select: { id: true, companyName: true } },
              site: { select: { id: true, name: true } },
            },
          },
          generatedJob: { select: { id: true, jobNumber: true } },
        },
      }),
      prisma.momActionPoint.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { serviceTypeSchema } from "@/lib/validation/masters";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("masters.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);
    const category = params.get("category");
    const status = params.get("status");

    const where: Prisma.ServiceTypeWhereInput = {
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.serviceType.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { jobs: true } } },
      }),
      prisma.serviceType.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("masters.create");
    const data = serviceTypeSchema.parse(await req.json());

    const serviceType = await prisma.serviceType.create({ data });

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "CREATE",
      module: "masters",
      recordId: serviceType.id,
      recordLabel: serviceType.name,
      newValue: data,
    });

    return created(serviceType);
  } catch (e) {
    return fail(e);
  }
}

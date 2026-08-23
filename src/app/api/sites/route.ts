import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { siteSchema } from "@/lib/validation/masters";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("sites.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const where: Prisma.SiteWhereInput = {
      deletedAt: null,
      ...(params.get("customerId") ? { customerId: params.get("customerId")! } : {}),
      ...(params.get("status") ? { status: params.get("status") as "ACTIVE" | "INACTIVE" } : {}),
      ...(params.get("city") ? { city: { contains: params.get("city")!, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { contactPerson: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
              { customer: { companyName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.site.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        include: {
          customer: { select: { id: true, code: true, companyName: true } },
          _count: { select: { equipment: true, jobs: true } },
        },
      }),
      prisma.site.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("sites.create");
    const data = siteSchema.parse(await req.json());
    const code = await nextNumber("SITE");

    const site = await prisma.site.create({
      data: { ...data, code, createdById: user.id, updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "sites",
      recordId: site.id, recordLabel: `${site.code} — ${site.name}`,
      newValue: data,
    });

    return created(site);
  } catch (e) {
    return fail(e);
  }
}

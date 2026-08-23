import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { equipmentSchema } from "@/lib/validation/masters";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("equipment.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const where: Prisma.EquipmentWhereInput = {
      deletedAt: null,
      ...(params.get("customerId") ? { customerId: params.get("customerId")! } : {}),
      ...(params.get("siteId") ? { siteId: params.get("siteId")! } : {}),
      ...(params.get("type") ? { type: params.get("type") as never } : {}),
      ...(params.get("amcStatus") ? { amcStatus: params.get("amcStatus") as never } : {}),
      ...(params.get("status") ? { status: params.get("status") as "ACTIVE" | "INACTIVE" } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { serialNumber: { contains: q, mode: "insensitive" } },
              { make: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { customer: { companyName: { contains: q, mode: "insensitive" } } },
              { site: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        include: {
          customer: { select: { id: true, code: true, companyName: true } },
          site: { select: { id: true, code: true, name: true } },
          _count: { select: { jobs: true } },
        },
      }),
      prisma.equipment.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("equipment.create");
    const data = equipmentSchema.parse(await req.json());
    const code = await nextNumber("EQP");

    const equipment = await prisma.equipment.create({
      data: { ...data, code, createdById: user.id, updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "equipment",
      recordId: equipment.id, recordLabel: `${equipment.code} — ${equipment.name}`,
      newValue: data,
    });

    return created(equipment);
  } catch (e) {
    return fail(e);
  }
}

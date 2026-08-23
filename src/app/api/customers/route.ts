import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { customerSchema } from "@/lib/validation/masters";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("customers.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(params.get("status") ? { status: params.get("status") as "ACTIVE" | "INACTIVE" } : {}),
      ...(params.get("city") ? { city: { contains: params.get("city")!, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { contactPerson: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
              { whatsapp: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { gstNumber: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { companyName: "asc" },
        select: {
          id: true, code: true, companyName: true, contactPerson: true, mobile: true,
          whatsapp: true, email: true, city: true, state: true, gstNumber: true,
          industry: true, status: true, createdAt: true,
          _count: { select: { sites: true, equipment: true, jobs: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("customers.create");
    const data = customerSchema.parse(await req.json());
    const code = await nextNumber("CUST");

    const customer = await prisma.customer.create({
      data: { ...data, code, createdById: user.id, updatedById: user.id },
    });

    await audit({
      userId: user.id, userName: user.name, action: "CREATE", module: "customers",
      recordId: customer.id, recordLabel: `${customer.code} — ${customer.companyName}`,
      newValue: data,
    });

    return created(customer);
  } catch (e) {
    return fail(e);
  }
}

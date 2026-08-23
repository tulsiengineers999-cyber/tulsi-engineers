import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { Prisma, ConfirmationStatus, DocumentType } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("confirmations.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const status = params.get("status");
    const docType = params.get("docType");
    const customerId = params.get("customerId");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.ClientConfirmationWhereInput[] = [];
    if (status) and.push({ status: status as ConfirmationStatus });
    if (docType) and.push({ docType: docType as DocumentType });
    if (customerId) and.push({ customerId });
    if (from || to) {
      and.push({
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
        },
      });
    }
    if (q) {
      and.push({
        OR: [
          { recordNumber: { contains: q, mode: "insensitive" } },
          { clientName: { contains: q, mode: "insensitive" } },
          { clientMobile: { contains: q } },
          { clientEmail: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.ClientConfirmationWhereInput = and.length ? { AND: and } : {};

    const [items, total, summary] = await Promise.all([
      prisma.clientConfirmation.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.clientConfirmation.count({ where }),
      prisma.clientConfirmation.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    // Customer names are joined in a second query so the list stays a single flat shape.
    const customerIds = [...new Set(items.map((i) => i.customerId))];
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, companyName: true } })
      : [];
    const nameById = new Map(customers.map((c) => [c.id, c.companyName]));

    const rows = items.map((i) => ({
      ...i,
      customerName: nameById.get(i.customerId) ?? "—",
      summary: undefined,
    }));

    const response = paginated(rows, total, page, pageSize);
    const body = await response.json();
    return Response.json({
      ...body,
      summary: Object.fromEntries(summary.map((s) => [s.status, s._count._all])),
    });
  } catch (e) {
    return fail(e);
  }
}

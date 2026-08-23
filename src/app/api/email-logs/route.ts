import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, paginated, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { Prisma, ChannelStatus } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("email.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const status = params.get("status");
    const customerId = params.get("customerId");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.EmailLogWhereInput[] = [];
    if (status) and.push({ status: status as ChannelStatus });
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
          { toEmail: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { recordNumber: { contains: q, mode: "insensitive" } },
          { templateCode: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.EmailLogWhereInput = and.length ? { AND: and } : {};

    const [items, total] = await Promise.all([
      prisma.emailLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.emailLog.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

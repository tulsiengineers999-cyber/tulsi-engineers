import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { paginated, fail, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import type { AuditAction, Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("audit.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);

    const userId = params.get("userId");
    const moduleFilter = params.get("module");
    const action = params.get("action");
    const from = params.get("from");
    const to = params.get("to");

    const and: Prisma.AuditLogWhereInput[] = [];
    if (userId) and.push({ userId });
    if (moduleFilter) and.push({ module: moduleFilter });
    if (action) and.push({ action: action as AuditAction });
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
          { userName: { contains: q, mode: "insensitive" } },
          { recordLabel: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.auditLog.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

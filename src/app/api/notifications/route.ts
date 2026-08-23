import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { paginated, fail, parseListParams } from "@/lib/http";
import { requirePermission } from "@/lib/guard";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("notifications.view");
    const { skip, take, page, pageSize, params } = parseListParams(req.url);
    const unreadOnly = params.get("unread") === "1";

    const where = { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requirePermission("users.view", "users.manage");
    const { id } = await params;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) throw Errors.notFound("This user could not be found.");

    const [loginHistory, sessions] = await Promise.all([
      prisma.loginHistory.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.session.findMany({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, userAgent: true, ipAddress: true, expiresAt: true, createdAt: true },
      }),
    ]);

    return ok({ loginHistory, sessions });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("users.manage");
    const { id } = await params;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw Errors.notFound("This user could not be found.");

    const result = await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CHANGED",
      module: "users",
      recordId: id,
      recordLabel: user.name,
      description: `All sessions revoked (${result.count})`,
    });

    return ok({ revoked: result.count });
  } catch (e) {
    return fail(e);
  }
}

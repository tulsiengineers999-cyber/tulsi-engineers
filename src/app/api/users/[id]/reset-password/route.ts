import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Never persisted anywhere except this response — the caller must show it once. */
function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%*!";
  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const all = upper + lower + digits + symbols;
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requirePermission("users.manage");
    const { id } = await params;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw Errors.notFound("This user could not be found.");

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), updatedById: actor.id },
      }),
      prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CHANGED",
      module: "users",
      recordId: id,
      recordLabel: `${user.name} (${user.email})`,
      description: "Password reset by administrator; all sessions revoked",
    });

    return ok({ temporaryPassword });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation/auth";
import { hashPassword, verifyPassword, checkPasswordStrength } from "@/lib/auth/password";
import { requireUser } from "@/lib/guard";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser();
    const body = changePasswordSchema.parse(await req.json());

    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw Errors.validation("Your current password is incorrect.");
    }
    const strength = checkPasswordStrength(body.password);
    if (!strength.ok) throw Errors.validation(strength.problems.join(". "));

    await prisma.user.update({
      where: { id: me.id },
      data: {
        passwordHash: await hashPassword(body.password),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    await audit({ userId: me.id, userName: me.name, action: "UPDATE", module: "auth", description: "Password changed" });
    return ok({ message: "Password updated successfully." });
  } catch (e) {
    return fail(e);
  }
}

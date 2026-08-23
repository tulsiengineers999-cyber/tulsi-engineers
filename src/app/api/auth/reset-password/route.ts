import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { hashPassword, checkPasswordStrength } from "@/lib/auth/password";
import { sha256 } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await req.json());
    const strength = checkPasswordStrength(body.password);
    if (!strength.ok) throw Errors.validation(strength.problems.join(". "));

    const token = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(body.token) },
      include: { user: true },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw Errors.validation("This reset link is invalid or has expired. Please request a new one.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await hashPassword(body.password),
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      // invalidate every existing session for this user
      prisma.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await audit({
      userId: token.userId,
      userName: token.user.name,
      action: "UPDATE",
      module: "auth",
      description: "Password reset completed",
    });

    return ok({ message: "Your password has been reset. You can now sign in." });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { sha256 } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { sendTemplatedEmail } from "@/lib/services/email";
import { audit } from "@/lib/audit";

/**
 * Always returns success so the endpoint cannot be used to enumerate accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = forgotPasswordSchema.parse(await req.json());
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null, status: "ACTIVE" },
    });

    if (user) {
      const raw = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = `${env.appUrl}/reset-password?token=${raw}`;
      await sendTemplatedEmail({
        templateCode: "PASSWORD_RESET",
        to: user.email,
        variables: { user_name: user.name, reset_link: link, expiry_minutes: "60" },
      });
      await audit({ userId: user.id, userName: user.name, action: "UPDATE", module: "auth", description: "Password reset requested" });
    }

    return ok({ message: "If that account exists, a reset link has been sent." });
  } catch (e) {
    return fail(e);
  }
}

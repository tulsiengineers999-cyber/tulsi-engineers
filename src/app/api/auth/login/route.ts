import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, Errors } from "@/lib/http";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, requestMeta } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const meta = await requestMeta();
    const identifier = body.email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: { role: true },
    });

    const recordFailure = async (reason: string) => {
      await prisma.loginHistory.create({
        data: {
          userId: user?.id ?? null,
          email: identifier,
          success: false,
          reason,
          ipAddress: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      await audit({
        userId: user?.id,
        userName: user?.name,
        action: "LOGIN_FAILED",
        module: "auth",
        description: reason,
      });
    };

    if (!user) {
      await recordFailure("Unknown email or username");
      throw Errors.unauthorized("Invalid email or password.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await recordFailure("Account temporarily locked");
      throw Errors.locked(`Too many failed attempts. Try again in ${mins} minute(s).`);
    }

    if (user.status !== "ACTIVE") {
      await recordFailure(`Account status is ${user.status}`);
      throw Errors.forbidden("This account is not active. Please contact your administrator.");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      await recordFailure("Incorrect password");
      if (failed >= MAX_FAILED) {
        throw Errors.locked(`Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.`);
      }
      throw Errors.unauthorized(`Invalid email or password. ${MAX_FAILED - failed} attempt(s) remaining.`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        email: identifier,
        success: true,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await createSession(user.id, meta);
    await audit({ userId: user.id, userName: user.name, action: "LOGIN", module: "auth" });

    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code,
      mustChangePassword: user.mustChangePassword,
      redirectTo: user.isEngineer || user.isTechnician ? "/field" : "/dashboard",
    });
  } catch (e) {
    return fail(e);
  }
}

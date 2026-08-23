import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { expandPermissions } from "@/lib/rbac";

export const SESSION_COOKIE = "te_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  isEngineer: boolean;
  isTechnician: boolean;
  permissions: string[];
  mustChangePassword: boolean;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Issues a signed JWT bound to a DB session row so it can be revoked server-side. */
export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3600 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt,
    },
  });

  const jwt = await new SignJWT({ sid: raw, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("tulsi-engineers")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: expiresAt,
  });

  return { expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, secretKey(), { issuer: "tulsi-engineers" });
      const sid = payload.sid as string;
      await prisma.session.updateMany({
        where: { tokenHash: sha256(sid), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* token already invalid — nothing to revoke */
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Resolves the current user from the session cookie, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;

  let sid: string;
  try {
    const { payload } = await jwtVerify(jwt, secretKey(), { issuer: "tulsi-engineers" });
    sid = payload.sid as string;
  } catch {
    return null;
  }

  const session = await prisma.session
    .findUnique({
      where: { tokenHash: sha256(sid) },
      include: {
        user: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    })
    .catch(() => null);

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (!u || u.deletedAt || u.status !== "ACTIVE") return null;

  const perms = u.role.rolePermissions.map((rp) => rp.permission.code);
  const permissions = u.role.code === "SUPER_ADMIN" ? expandPermissions(["*"]) : perms;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleCode: u.role.code,
    roleName: u.role.name,
    isEngineer: u.isEngineer,
    isTechnician: u.isTechnician,
    permissions,
    mustChangePassword: u.mustChangePassword,
  };
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

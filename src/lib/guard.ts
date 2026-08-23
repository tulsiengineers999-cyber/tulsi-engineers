import "server-only";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { can, canAny } from "@/lib/rbac";
import { Errors } from "@/lib/http";

/** Throws 401 when signed out. Use at the top of every protected API route. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

/** Throws 401/403. `codes` are OR-ed: any one grants access. */
export async function requirePermission(...codes: string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAny(user.permissions, codes)) {
    throw Errors.forbidden(
      `Your role (${user.roleName}) is not allowed to perform this action.`,
    );
  }
  return user;
}

export function assertPermission(user: SessionUser, code: string) {
  if (!can(user.permissions, code)) {
    throw Errors.forbidden(`Your role (${user.roleName}) is not allowed to perform this action.`);
  }
}

/**
 * Engineers and technicians only see their own jobs unless they hold a
 * management-level permission. Returns a Prisma `where` fragment.
 */
export function scopeToOwnJobs(user: SessionUser) {
  const isFieldOnly =
    (user.isEngineer || user.isTechnician) && !can(user.permissions, "jobs.assign");
  if (!isFieldOnly) return {};
  return {
    OR: [
      { engineerId: user.id },
      { technicianId: user.id },
      { assignments: { some: { userId: user.id, unassignedAt: null } } },
    ],
  };
}

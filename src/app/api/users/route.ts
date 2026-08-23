import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { created, fail, paginated, parseListParams, Errors } from "@/lib/http";
import { requirePermission } from "@/lib/guard";
import { userSchema } from "@/lib/validation/masters";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import type { Prisma, UserStatus } from "@/generated/prisma";

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

const LIST_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  username: true,
  mobile: true,
  designation: true,
  department: true,
  status: true,
  isEngineer: true,
  isTechnician: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;

const SAFE_SELECT = {
  ...LIST_SELECT,
  whatsapp: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function GET(req: NextRequest) {
  try {
    await requirePermission("users.view");
    const { q, skip, take, page, pageSize, params } = parseListParams(req.url);
    const roleId = params.get("roleId");
    const status = params.get("status");
    const isEngineer = params.get("isEngineer");
    const isTechnician = params.get("isTechnician");

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(roleId ? { roleId } : {}),
      ...(status ? { status: status as UserStatus } : {}),
      ...(isEngineer === "1" ? { isEngineer: true } : {}),
      ...(isTechnician === "1" ? { isTechnician: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, orderBy: { name: "asc" }, select: LIST_SELECT }),
      prisma.user.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission("users.create");
    const body = userSchema.parse(await req.json());

    const role = await prisma.role.findUnique({ where: { id: body.roleId } });
    if (!role) throw Errors.validation("Please choose a valid role.");
    if (role.code === "SUPER_ADMIN" && actor.roleCode !== "SUPER_ADMIN") {
      throw Errors.forbidden("Only a Super Admin can create another Super Admin account.");
    }

    let temporaryPassword: string | undefined;
    if (!body.password) temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword ?? body.password!);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        username: body.username,
        employeeCode: body.employeeCode,
        mobile: body.mobile,
        whatsapp: body.whatsapp,
        designation: body.designation,
        department: body.department,
        roleId: body.roleId,
        isEngineer: body.isEngineer,
        isTechnician: body.isTechnician,
        status: body.status,
        passwordHash,
        mustChangePassword: temporaryPassword ? true : body.mustChangePassword,
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: SAFE_SELECT,
    });

    await audit({
      userId: actor.id,
      userName: actor.name,
      action: "USER_CHANGED",
      module: "users",
      recordId: user.id,
      recordLabel: `${user.name} (${user.email})`,
      description: temporaryPassword ? "User created with a system-generated temporary password" : "User created",
      newValue: { name: user.name, email: user.email, roleId: body.roleId, status: user.status },
    });

    return created({ ...user, temporaryPassword });
  } catch (e) {
    return fail(e);
  }
}

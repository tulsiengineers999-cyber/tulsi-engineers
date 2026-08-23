import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma";
import { requestMeta } from "@/lib/auth/session";

interface AuditInput {
  userId?: string | null;
  userName?: string | null;
  action: AuditAction;
  module: string;
  recordId?: string | null;
  recordLabel?: string | null;
  description?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

const REDACT = /password|token|secret|otp|accessToken|apiKey/i;

function scrub(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT.test(k)) {
      out[k] = "[redacted]";
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (typeof v === "object" && v !== null) {
      out[k] = scrub(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Never throws — an audit failure must not break the user's action. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const meta = await requestMeta().catch(() => ({ ip: undefined, userAgent: undefined }));
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        recordLabel: input.recordLabel ?? null,
        description: input.description ?? null,
        oldValue: (scrub(input.oldValue) ?? undefined) as never,
        newValue: (scrub(input.newValue) ?? undefined) as never,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log entry", err);
  }
}

/** Returns only the fields that actually changed, for a compact audit diff. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    const same =
      a instanceof Date && b instanceof Date
        ? a.getTime() === b.getTime()
        : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) {
      oldValue[key] = a ?? null;
      newValue[key] = b ?? null;
    }
  }
  return { oldValue, newValue, changed: Object.keys(newValue).length > 0 };
}

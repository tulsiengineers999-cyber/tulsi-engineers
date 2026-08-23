import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (msg = "Please sign in to continue.") => new AppError(msg, 401, "UNAUTHORIZED"),
  forbidden: (msg = "You do not have permission to perform this action.") =>
    new AppError(msg, 403, "FORBIDDEN"),
  notFound: (msg = "The requested record was not found.") => new AppError(msg, 404, "NOT_FOUND"),
  conflict: (msg: string) => new AppError(msg, 409, "CONFLICT"),
  validation: (msg: string, details?: unknown) => new AppError(msg, 422, "VALIDATION_ERROR", details),
  tooMany: (msg = "Too many attempts. Please try again later.") =>
    new AppError(msg, 429, "RATE_LIMITED"),
  locked: (msg: string) => new AppError(msg, 423, "LOCKED"),
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data: items,
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/**
 * Converts any thrown value into a safe client response.
 * Internal details (stack traces, driver errors, secrets) are logged
 * server-side only — never returned to the caller.
 */
export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields.", details: fieldErrors },
      },
      { status: 422 },
    );
  }

  const e = error as { code?: string; meta?: { target?: string[] } };
  if (e?.code === "P2002") {
    const target = e.meta?.target?.join(", ") ?? "value";
    return NextResponse.json(
      { success: false, error: { code: "CONFLICT", message: `A record with this ${target} already exists.` } },
      { status: 409 },
    );
  }
  if (e?.code === "P2025") {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "The requested record was not found." } },
      { status: 404 },
    );
  }
  if (e?.code === "P2003") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "CONFLICT", message: "This record is linked to other records and cannot be changed." },
      },
      { status: 409 },
    );
  }

  console.error("[unhandled]", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

export function parseListParams(url: string, defaults?: { pageSize?: number }) {
  const sp = new URL(url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? defaults?.pageSize ?? 25) || 25));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q: (sp.get("q") ?? "").trim(),
    sort: sp.get("sort") ?? undefined,
    dir: (sp.get("dir") === "asc" ? "asc" : "desc") as "asc" | "desc",
    params: sp,
  };
}

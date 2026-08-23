"use client";

/** Thin fetch wrapper that unwraps the standard { success, data, error } envelope. */

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  meta?: { total: number; page: number; pageSize: number; pageCount: number };
  error?: { code: string; message: string; details?: Record<string, string> };
}

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, code: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your internet connection.", "NETWORK", 0);
  }

  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("The server returned an unexpected response.", "BAD_RESPONSE", res.status);
  }

  if (!res.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? "Something went wrong. Please try again.",
      json.error?.code ?? "ERROR",
      res.status,
      json.error?.details as Record<string, string> | undefined,
    );
  }
  return json;
}

export const api = {
  get: <T>(url: string) => request<T>(url).then((r) => r.data as T),
  list: <T>(url: string) => request<T[]>(url).then((r) => ({ items: (r.data ?? []) as T[], meta: r.meta })),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }).then(
      (r) => r.data as T,
    ),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body ?? {}) }).then((r) => r.data as T),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }).then((r) => r.data as T),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }).then((r) => r.data as T),
};

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

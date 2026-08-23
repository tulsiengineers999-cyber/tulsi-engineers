"use client";

import { useEffect, useState } from "react";
import { Monitor, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, Badge, LoadingBlock, EmptyState } from "@/components/ui/primitives";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";

interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

interface LoginRow {
  id: string;
  email: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Turns a raw user-agent into something an office user can recognise. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" on ");
}

export function SessionsPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<{ sessions: SessionRow[]; loginHistory: LoginRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ sessions: SessionRow[]; loginHistory: LoginRow[] }>(`/api/users/${userId}/sessions`)
      .then(setData)
      .catch(() => setData({ sessions: [], loginHistory: [] }))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <LoadingBlock label="Loading sign-in activity…" />;

  return (
    <div className="space-y-5">
      <Card title={`Active sessions (${data?.sessions.length ?? 0})`} bodyClassName={data?.sessions.length ? "p-0" : undefined}>
        {!data?.sessions.length ? (
          <EmptyState icon={Monitor} title="No active sessions" description="This user is not signed in anywhere right now." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{describeDevice(s.userAgent)}</p>
                  <p className="text-xs text-slate-500">
                    {s.ipAddress ?? "IP not recorded"} · signed in {formatDateTime(s.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">expires {formatDateTime(s.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent sign-in history" bodyClassName={data?.loginHistory.length ? "p-0" : undefined}>
        {!data?.loginHistory.length ? (
          <EmptyState icon={ShieldCheck} title="No sign-in attempts recorded" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.loginHistory.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div className="flex min-w-0 items-start gap-2.5">
                  {l.success ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">{l.success ? "Signed in" : (l.reason ?? "Failed sign-in")}</p>
                    <p className="text-xs text-slate-400">
                      {describeDevice(l.userAgent)} · {l.ipAddress ?? "IP not recorded"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] whitespace-nowrap text-slate-400">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function PermissionSummary({ permissions }: { permissions: { module: string; label: string; codes: string[] }[] }) {
  if (!permissions.length) {
    return <p className="text-sm text-slate-500">This role has no permissions assigned yet.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {permissions.map((p) => (
        <div key={p.module}>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-slate-500 uppercase">{p.label}</p>
          <div className="flex flex-wrap gap-1">
            {p.codes.map((c) => (
              <Badge key={c} tone="neutral">
                {c.split(".")[1]}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

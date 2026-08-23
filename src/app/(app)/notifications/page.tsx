"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, EmptyState, Checkbox } from "@/components/ui/primitives";
import { Pagination, type PageMeta } from "@/components/ui/DataTable";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, relativeDate } from "@/lib/format";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  recordId: string | null;
  readAt: string | null;
  createdAt: string;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default function NotificationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<NotificationRow>(
        `/api/notifications${qs({ unread: unreadOnly ? "1" : undefined, page, pageSize: 25 })}`,
      );
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load notifications", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = rows.filter((r) => !r.readAt).length;

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post("/api/notifications/read", {});
      toast.success("All notifications marked as read");
      load();
    } catch (err) {
      toast.error("Could not mark notifications as read", err instanceof ApiError ? err.message : undefined);
    } finally {
      setMarkingAll(false);
    }
  };

  const markOneRead = async (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, readAt: r.readAt ?? new Date().toISOString() } : r)));
    try {
      await api.post("/api/notifications/read", { ids: [id] });
    } catch {
      // non-fatal — the list will resync on next load
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, NotificationRow[]>();
    for (const r of rows) {
      const key = dayLabel(r.createdAt);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything that needs your attention, in one place."
        crumbs={[{ label: "Notifications" }]}
        actions={
          <>
            <Checkbox label="Unread only" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            <Button variant="outline" onClick={markAllRead} loading={markingAll} disabled={rows.every((r) => r.readAt)}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          </>
        }
      />

      <Card bodyClassName="p-0 sm:p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">Loading notifications…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={unreadOnly ? "No unread notifications" : "No notifications yet"}
            description="Job assignments, upcoming visits and pending confirmations will show up here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map(([day, items]) => (
              <div key={day}>
                <p className="bg-slate-50 px-4 py-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase sm:px-5">
                  {day} {unreadCount > 0 && day === "Today" ? `· ${items.filter((i) => !i.readAt).length} unread` : ""}
                </p>
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => {
                    const content = (
                      <div className={`flex items-start gap-3 px-4 py-3 sm:px-5 ${!n.readAt ? "bg-[var(--te-primary-light)]/40" : "hover:bg-slate-50"}`}>
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-[var(--te-accent)]" : "bg-transparent"}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${!n.readAt ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>{n.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{relativeDate(n.createdAt)} · {formatDateTime(n.createdAt)}</p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.link ? (
                          <Link href={n.link} onClick={() => !n.readAt && markOneRead(n.id)} className="block">
                            {content}
                          </Link>
                        ) : (
                          <button type="button" onClick={() => !n.readAt && markOneRead(n.id)} className="block w-full text-left">
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {meta && meta.pageCount > 1 && (
          <div className="px-4 pb-4 sm:px-5">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </>
  );
}

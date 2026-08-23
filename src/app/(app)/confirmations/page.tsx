"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Send, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, LoadingBlock, EmptyState } from "@/components/ui/primitives";
import { Pagination, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { SendToClientModal, type SendDocType } from "@/components/documents/SendToClientModal";
import { qs } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { CONFIRMATION_TONE } from "@/lib/ui";
import { DOC_TYPE_LABELS } from "@/lib/masters";
import { DOC_ROUTE } from "../communication";

interface ConfirmationRow {
  id: string;
  docType: string;
  recordId: string;
  recordNumber: string;
  version: number;
  customerId: string;
  customerName: string;
  clientName: string | null;
  clientMobile: string | null;
  clientEmail: string | null;
  status: string;
  verified: boolean;
  verificationChannel: string | null;
  correctionRemarks: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  CORRECTION_REQUESTED: "Correction requested",
  EXPIRED: "Expired",
};

export default function ConfirmationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ConfirmationRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [resend, setResend] = useState<ConfirmationRow | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [docType, setDocType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/confirmations${qs({ q, status, docType, from, to, page, pageSize: 30 })}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ConfirmationRow[];
        meta?: PageMeta;
        summary?: Record<string, number>;
        error?: { message: string };
      };
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Request failed");
      setRows(json.data ?? []);
      setMeta(json.meta);
      setSummary(json.summary ?? {});
    } catch (err) {
      toast.error("Could not load client confirmations", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, docType, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const activeFilters = [status, docType, from, to].filter(Boolean).length;

  const tiles = [
    { key: "CONFIRMED", label: "Confirmed", tone: "text-green-700" },
    { key: "PENDING", label: "Awaiting confirmation", tone: "text-amber-700" },
    { key: "CORRECTION_REQUESTED", label: "Correction requested", tone: "text-red-700" },
    { key: "EXPIRED", label: "Expired", tone: "text-slate-500" },
  ];

  return (
    <>
      <PageHeader
        title="Client Confirmations"
        description="Every report sent for confirmation, and whether the client has signed off on it."
        crumbs={[{ label: "Client Confirmations" }]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setStatus(status === t.key ? "" : t.key);
              setPage(1);
            }}
            className={`te-focus rounded-xl border bg-white p-4 text-left shadow-sm transition-colors ${
              status === t.key ? "border-[var(--te-primary)] ring-1 ring-[var(--te-primary)]" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className={`text-2xl font-bold ${t.tone}`}>{summary[t.key] ?? 0}</p>
            <p className="mt-0.5 text-[11px] tracking-wide text-slate-500 uppercase">{t.label}</p>
          </button>
        ))}
      </div>

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setStatus("");
              setDocType("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Search document number, client name or mobile…"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Document type"
              value={docType}
              onChange={(v) => {
                setDocType(v);
                setPage(1);
              }}
              options={[
                { value: "MOM", label: "Minutes of Meeting" },
                { value: "DAILY_WORK_REPORT", label: "Daily Work Report" },
                { value: "FINAL_SERVICE_REPORT", label: "Final Service Report" },
              ]}
              allLabel="All documents"
            />
            <input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
            />
            <input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="te-focus h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-600"
            />
          </FilterBar>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {loading ? (
            <LoadingBlock label="Loading confirmations…" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="No confirmations found"
              description="A confirmation record is created the moment a report is sent to a client."
            />
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Document", "Customer", "Client", "Version", "Verification", "Confirmed", "Status", ""].map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`${DOC_ROUTE[r.docType] ?? ""}/${r.recordId}`}
                            className="font-semibold text-[var(--te-primary)] hover:underline"
                          >
                            {r.recordNumber}
                          </Link>
                          <span className="block text-[11px] text-slate-400">{DOC_TYPE_LABELS[r.docType] ?? r.docType}</span>
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 text-slate-700">{r.customerName}</td>
                        <td className="px-3 py-2.5 text-slate-700">
                          <span className="block truncate">{r.clientName ?? "—"}</span>
                          <span className="block text-[11px] text-slate-400">{r.clientMobile ?? r.clientEmail ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">v{r.version}</td>
                        <td className="px-3 py-2.5">
                          {r.verified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <ShieldCheck className="h-3.5 w-3.5" /> OTP via {r.verificationChannel?.toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Not verified</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">
                          {r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={CONFIRMATION_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                          {r.correctionRemarks && (
                            <span className="mt-1 block max-w-[16rem] truncate text-[11px] text-red-600" title={r.correctionRemarks}>
                              {r.correctionRemarks}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {r.status !== "CONFIRMED" && (
                            <Button variant="outline" size="sm" onClick={() => setResend(r)}>
                              <Send className="h-3.5 w-3.5" /> Resend
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta && meta.pageCount > 1 && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </div>
      </Card>

      {resend && (
        <SendToClientModal
          open
          onClose={() => setResend(null)}
          docType={resend.docType as SendDocType}
          recordId={resend.recordId}
          recordNumber={resend.recordNumber}
          defaultEmail={resend.clientEmail}
          defaultWhatsapp={resend.clientMobile}
          onSent={() => {
            setResend(null);
            load();
          }}
        />
      )}
    </>
  );
}

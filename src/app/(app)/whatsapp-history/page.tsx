"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Alert, LoadingBlock, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Pagination, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { CHANNEL_TONE } from "@/lib/ui";
import { DOC_TYPE_LABELS } from "@/lib/masters";
import { isSimulated, DOC_ROUTE } from "../communication";

interface WhatsappLogRow {
  id: string;
  templateCode: string | null;
  templateName: string | null;
  toNumber: string;
  payload: unknown;
  bodyPreview: string | null;
  docType: string | null;
  recordId: string | null;
  recordNumber: string | null;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function WhatsappHistoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<WhatsappLogRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WhatsappLogRow | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<WhatsappLogRow>(`/api/whatsapp-logs${qs({ q, status, from, to, page, pageSize: 30 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load WhatsApp history", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, status, from, to, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const activeFilters = [status, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="WhatsApp History"
        description="Every template message sent through the WhatsApp Business Cloud API."
        crumbs={[{ label: "WhatsApp History" }]}
      />

      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setStatus("");
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
              placeholder="Search number, template or document number…"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "SENT", label: "Sent" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "READ", label: "Read" },
                { value: "QUEUED", label: "Queued" },
                { value: "FAILED", label: "Failed" },
              ]}
              allLabel="All statuses"
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
            <LoadingBlock label="Loading WhatsApp history…" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No WhatsApp messages found"
              description="Messages appear here as soon as a document is sent to a client over WhatsApp."
            />
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Sent", "To", "Template", "Document", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const sim = isSimulated(r.status, r.errorMessage);
                      return (
                        <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">
                            {formatDateTime(r.sentAt ?? r.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{r.toNumber}</td>
                          <td className="max-w-[16rem] truncate px-3 py-2.5 text-slate-700">{r.templateName ?? r.templateCode ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">{r.recordNumber ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            {sim ? (
                              <Badge tone="warning">Simulated</Badge>
                            ) : (
                              <Badge tone={CHANNEL_TONE[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {meta && meta.pageCount > 1 && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </div>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.templateName ?? selected?.templateCode ?? "WhatsApp message"}
        description={selected ? `To ${selected.toNumber} · ${formatDateTime(selected.sentAt ?? selected.createdAt)}` : undefined}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            {isSimulated(selected.status, selected.errorMessage) ? (
              <Alert tone="warning" title="Recorded but not transmitted">
                WhatsApp sending is currently set to LOG mode, so this message was written to the history but never
                left the server. Set <code>WHATSAPP_DRIVER=CLOUD_API</code> with valid credentials in System Settings →
                Integrations to send for real.
              </Alert>
            ) : selected.status === "FAILED" && selected.errorMessage ? (
              <Alert tone="danger" title="This message failed to send">
                {selected.errorMessage}
              </Alert>
            ) : null}

            <div>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                What the customer receives
              </p>
              <div className="max-w-md rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-sm leading-relaxed whitespace-pre-line text-slate-800 shadow-sm">
                {selected.bodyPreview ?? "No preview recorded."}
              </div>
            </div>

            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="Template code">{selected.templateCode ?? "—"}</Row>
              <Row label="Meta template name">{selected.templateName ?? "—"}</Row>
              <Row label="Provider message id">{selected.providerMessageId ?? "—"}</Row>
              <Row label="Document">
                {selected.recordNumber && selected.docType && selected.recordId ? (
                  <Link
                    href={`${DOC_ROUTE[selected.docType] ?? ""}/${selected.recordId}`}
                    className="font-medium text-[var(--te-primary)] hover:underline"
                  >
                    {DOC_TYPE_LABELS[selected.docType] ?? selected.docType} {selected.recordNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
            </dl>

            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">
                Outbound payload sent to the Cloud API
              </summary>
              <pre className="overflow-x-auto border-t border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
              <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                The access token is sent as an HTTP header and is never stored in this record.
              </p>
            </details>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="text-sm break-words text-slate-800">{children}</dd>
    </div>
  );
}

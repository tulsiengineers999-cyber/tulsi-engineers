"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Download, Trash2, Images } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, Button, LoadingBlock, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination, type PageMeta } from "@/components/ui/DataTable";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/Filters";
import { PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { ConfirmDialog } from "@/components/ui/Modal";
import { api, qs, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, formatDateTime } from "@/lib/format";
import { PHOTO_CATEGORY_LABELS } from "@/lib/masters";

interface PhotoRow extends GalleryPhoto {
  jobId: string | null;
  job: { id: string; jobNumber: string; site: { name: string } | null; customer: { companyName: string } | null } | null;
}

interface DocumentRow {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  createdAt: string;
  uploadedBy: { name: string } | null;
  customer: { id: string; companyName: string } | null;
  job: { id: string; jobNumber: string } | null;
}

export default function PhotosPage() {
  const toast = useToast();
  const [tab, setTab] = useState("photos");

  return (
    <>
      <PageHeader
        title="Photos & Documents"
        description="Everything captured on site and every file attached to a record."
        crumbs={[{ label: "Photos & Documents" }]}
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "photos", label: "Photos" },
          { key: "documents", label: "Documents" },
        ]}
      />
      {tab === "photos" ? <PhotosTab toast={toast} /> : <DocumentsTab toast={toast} />}
    </>
  );
}

function PhotosTab({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<PhotoRow>(`/api/photos${qs({ q, category, page, pageSize: 48 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load photos", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, category, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <Card bodyClassName="p-0 sm:p-0">
      <div className="p-4 pb-0 sm:p-5 sm:pb-0">
        <FilterBar
          activeCount={category ? 1 : 0}
          onReset={() => {
            setCategory("");
            setPage(1);
          }}
        >
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Search description or file name…"
          />
          <FilterSelect
            label="Category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={Object.entries(PHOTO_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
            allLabel="All categories"
          />
        </FilterBar>
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {loading ? (
          <LoadingBlock label="Loading photographs…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No photographs found"
            description="Photographs are uploaded from the field interface or from a site visit, MOM or daily report."
          />
        ) : (
          <>
            <PhotoGallery photos={rows} canDelete onDeleted={load} />
            {meta && meta.pageCount > 1 && <Pagination meta={meta} onPageChange={setPage} />}
          </>
        )}
      </div>
    </Card>
  );
}

function DocumentsTab({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<DocumentRow>(`/api/files/documents${qs({ q, page, pageSize: 30 })}`);
      setRows(res.items);
      setMeta(res.meta);
    } catch (err) {
      toast.error("Could not load documents", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [q, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/files/documents/${deleteTarget.id}`);
      toast.success("Document deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error("Could not delete this document", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const kind = (mime: string) =>
    mime.includes("pdf") ? "PDF" : mime.includes("sheet") || mime.includes("excel") ? "Excel" : mime.includes("word") ? "Word" : "File";

  return (
    <>
      <Card bodyClassName="p-0 sm:p-0">
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <FilterBar>
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Search title, file name or description…"
            />
          </FilterBar>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {loading ? (
            <LoadingBlock label="Loading documents…" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents uploaded"
              description="Attach drawings, test certificates, purchase orders and other files to a customer, job or report."
            />
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Document", "Type", "Linked to", "Size", "Uploaded", ""].map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((d) => (
                      <tr key={d.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-3 py-2.5">
                          <a
                            href={`/api/files/${d.id}?type=document`}
                            className="font-medium text-[var(--te-primary)] hover:underline"
                          >
                            {d.title ?? d.fileName}
                          </a>
                          {d.description && <span className="block max-w-[22rem] truncate text-xs text-slate-400">{d.description}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone="neutral">{kind(d.mimeType)}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {d.job ? (
                            <Link href={`/jobs/${d.job.id}`} className="hover:underline">
                              {d.job.jobNumber}
                            </Link>
                          ) : d.customer ? (
                            <Link href={`/customers/${d.customer.id}`} className="hover:underline">
                              {d.customer.companyName}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{formatBytes(d.sizeBytes)}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">
                          <span className="block">{formatDateTime(d.createdAt)}</span>
                          <span className="block text-slate-400">{d.uploadedBy?.name ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <a
                            href={`/api/files/${d.id}?type=document`}
                            className="te-focus mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            aria-label={`Download ${d.fileName}`}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(d)}
                            aria-label={`Delete ${d.fileName}`}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        loading={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete this document?"
        confirmLabel="Delete document"
        message={
          <>
            <b>{deleteTarget?.title ?? deleteTarget?.fileName}</b> will be removed from the record and from storage.
            This cannot be undone.
          </>
        }
      />
    </>
  );
}

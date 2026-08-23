"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Send, FileText, Download, Printer, Trash2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export interface VisitPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canPdf: boolean;
  canCreateMom: boolean;
}

export function VisitActions({
  visit,
  permissions,
}: {
  visit: { id: string; visitNumber: string; jobId: string; status: string };
  permissions: VisitPermissions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const previewUrl = `/api/documents/SITE_VISIT_REPORT/${visit.id}/preview`;
  const pdfUrl = `/api/documents/SITE_VISIT_REPORT/${visit.id}/pdf`;
  const isDraft = visit.status === "DRAFT";

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/visits/${visit.id}/submit`);
      toast.success("Site visit submitted", "It can now be shared and referenced by a MOM.");
      router.refresh();
    } catch (err) {
      toast.error("Could not submit this visit", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/visits/${visit.id}`);
      toast.success("Site visit deleted");
      router.push("/visits");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete this visit", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="grid gap-2">
        {isDraft && permissions.canEdit && (
          <Button variant="primary" onClick={submit} loading={busy}>
            <Send className="h-4 w-4" /> Submit visit
          </Button>
        )}
        {permissions.canCreateMom && (
          <LinkButton href={`/mom/new?jobId=${visit.jobId}&siteVisitId=${visit.id}`} variant="accent">
            <FileText className="h-4 w-4" /> Create MOM from this visit
          </LinkButton>
        )}
        {permissions.canPdf && (
          <>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Preview &amp; print
            </a>
            <a
              href={pdfUrl}
              className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </>
        )}
        {permissions.canEdit && (
          <LinkButton href={`/visits/${visit.id}/edit`} variant="ghost">
            <Pencil className="h-4 w-4" /> Edit visit
          </LinkButton>
        )}
        {permissions.canDelete && (
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Delete visit
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        loading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this site visit?"
        confirmLabel="Delete visit"
        message={
          <>
            <b>{visit.visitNumber}</b> and its observations will be removed from lists. Visits that a MOM already
            references cannot be deleted, because the MOM depends on them.
          </>
        }
      />
    </>
  );
}

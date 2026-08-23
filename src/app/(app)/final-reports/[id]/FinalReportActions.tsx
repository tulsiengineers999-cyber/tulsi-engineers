"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Send, Download, Eye, History, Trash2, FileCheck2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { SendToClientModal } from "@/components/documents/SendToClientModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export interface FinalReportActionsRecord {
  id: string;
  jobId: string;
  reportNumber: string;
  status: string;
  defaultEmail: string | null;
  defaultWhatsapp: string | null;
}

export function FinalReportActions({ report }: { report: FinalReportActionsRecord }) {
  const router = useRouter();
  const toast = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async () => {
    setBusy("submit");
    try {
      await api.post(`/api/final-reports/${report.id}/submit`);
      toast.success("Report submitted");
      router.refresh();
    } catch (err) {
      toast.error("Could not submit report", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const revise = async () => {
    setBusy("revise");
    try {
      await api.post(`/api/documents/FINAL_SERVICE_REPORT/${report.id}/revise`);
      toast.success("New version started");
      router.push(`/final-reports/${report.id}/edit`);
    } catch (err) {
      toast.error("Could not revise report", err instanceof ApiError ? err.message : undefined);
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await api.del(`/api/final-reports/${report.id}`);
      toast.success("Report deleted");
      router.push("/final-reports");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete report", err instanceof ApiError ? err.message : undefined);
      setBusy(null);
      setDeleteOpen(false);
    }
  };

  const markCompleted = async () => {
    setBusy("complete");
    try {
      await api.post(`/api/jobs/${report.jobId}/status`, { status: "COMPLETED" });
      toast.success("Job marked as completed");
      setCompleteOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not mark job as completed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => router.push(`/final-reports/${report.id}/edit`)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
      {report.status === "DRAFT" && (
        <Button onClick={submit} loading={busy === "submit"}>
          <FileCheck2 className="h-4 w-4" /> Submit
        </Button>
      )}
      <Button variant="outline" onClick={() => window.open(`/api/documents/FINAL_SERVICE_REPORT/${report.id}/preview`, "_blank")}>
        <Eye className="h-4 w-4" /> Preview PDF
      </Button>
      <Button variant="outline" onClick={() => window.open(`/api/documents/FINAL_SERVICE_REPORT/${report.id}/pdf`, "_blank")}>
        <Download className="h-4 w-4" /> Download PDF
      </Button>
      {report.status !== "DRAFT" && (
        <Button variant="accent" onClick={() => setSendOpen(true)}>
          <Send className="h-4 w-4" /> Send to client
        </Button>
      )}
      {report.status === "CLIENT_CONFIRMED" && (
        <Button variant="success" onClick={() => setCompleteOpen(true)}>
          <CheckCircle2 className="h-4 w-4" /> Mark job completed
        </Button>
      )}
      {report.status === "CLIENT_CONFIRMED" && (
        <Button variant="outline" onClick={revise} loading={busy === "revise"}>
          <History className="h-4 w-4" /> Revise
        </Button>
      )}
      {report.status !== "CLIENT_CONFIRMED" && (
        <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}

      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docType="FINAL_SERVICE_REPORT"
        recordId={report.id}
        recordNumber={report.reportNumber}
        defaultEmail={report.defaultEmail}
        defaultWhatsapp={report.defaultWhatsapp}
        onSent={() => { setSendOpen(false); router.refresh(); }}
      />

      <ConfirmDialog
        open={deleteOpen}
        loading={busy === "delete"}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this final service report?"
        confirmLabel="Delete report"
        message={
          <>
            <b>{report.reportNumber}</b> will be removed from lists and searches. This cannot be undone.
          </>
        }
      />

      <ConfirmDialog
        open={completeOpen}
        loading={busy === "complete"}
        onClose={() => setCompleteOpen(false)}
        onConfirm={markCompleted}
        tone="primary"
        title="Mark this job as completed?"
        confirmLabel="Mark completed"
        message="The service job linked to this report will move to Completed status."
      />
    </>
  );
}

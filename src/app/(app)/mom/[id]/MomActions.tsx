"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Send, Eye, Download, Printer, RotateCcw, Trash2, Copy } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { SendToClientModal } from "@/components/documents/SendToClientModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export interface MomActionsPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canPdf: boolean;
  canDownload: boolean;
  canPrint: boolean;
  canSend: boolean;
  canDelete: boolean;
}

export function MomActions({
  mom,
  permissions,
}: {
  mom: {
    id: string;
    momNumber: string;
    status: string;
    defaultEmail: string | null;
    defaultWhatsapp: string | null;
  };
  permissions: MomActionsPermissions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/mom/${mom.id}/submit`);
      toast.success("MOM submitted");
      router.refresh();
    } catch (err) {
      toast.error("Could not submit this MOM", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const revise = async () => {
    setBusy(true);
    try {
      await api.post(`/api/mom/${mom.id}/revise`);
      toast.success("New version created");
      router.push(`/mom/${mom.id}/edit`);
    } catch (err) {
      toast.error("Could not revise this MOM", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/mom/${mom.id}`);
      toast.success("MOM deleted");
      router.push("/mom");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete this MOM", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <>
      {permissions.canEdit && mom.status !== "CLIENT_CONFIRMED" && (
        <LinkButton href={`/mom/${mom.id}/edit`} variant="outline">
          <Pencil className="h-4 w-4" /> Edit
        </LinkButton>
      )}
      {permissions.canSubmit && mom.status === "DRAFT" && (
        <Button variant="outline" onClick={submit} loading={busy}>
          <Send className="h-4 w-4" /> Submit
        </Button>
      )}
      {permissions.canPdf && (
        <Button variant="outline" onClick={() => window.open(`/api/documents/MOM/${mom.id}/preview`, "_blank", "noopener,noreferrer")}>
          <Eye className="h-4 w-4" /> Preview PDF
        </Button>
      )}
      {permissions.canDownload && (
        <Button variant="outline" onClick={() => window.open(`/api/documents/MOM/${mom.id}/pdf`, "_blank", "noopener,noreferrer")}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      )}
      {permissions.canPrint && (
        <Button variant="outline" onClick={() => window.open(`/api/documents/MOM/${mom.id}/preview`, "_blank", "noopener,noreferrer")}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      )}
      {permissions.canSend && (
        <Button variant="outline" onClick={() => setSendOpen(true)}>
          <Send className="h-4 w-4" /> Send to client
        </Button>
      )}
      <Button variant="outline" onClick={copyLink}>
        <Copy className="h-4 w-4" /> Copy link
      </Button>
      {permissions.canEdit && mom.status === "CLIENT_CONFIRMED" && (
        <Button variant="outline" onClick={revise} loading={busy}>
          <RotateCcw className="h-4 w-4" /> Revise
        </Button>
      )}
      {permissions.canDelete && mom.status !== "CLIENT_CONFIRMED" && (
        <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )}

      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docType="MOM"
        recordId={mom.id}
        recordNumber={mom.momNumber}
        defaultEmail={mom.defaultEmail}
        defaultWhatsapp={mom.defaultWhatsapp}
        onSent={() => { setSendOpen(false); router.refresh(); }}
      />

      <ConfirmDialog
        open={deleteOpen}
        loading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this MOM?"
        confirmLabel="Delete MOM"
        message={
          <>
            <b>{mom.momNumber}</b> will be removed from lists and searches. This cannot be done once the client has
            confirmed the meeting record.
          </>
        }
      />
    </>
  );
}

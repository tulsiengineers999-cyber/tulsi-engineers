"use client";

import { useEffect, useState } from "react";
import { Copy, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Textarea, Checkbox, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";
import { DOC_TYPE_LABELS } from "@/lib/masters";

export type SendDocType = "MOM" | "DAILY_WORK_REPORT" | "FINAL_SERVICE_REPORT" | "SITE_VISIT_REPORT";

interface SendResult {
  channel: string;
  delivered: boolean;
  simulated?: boolean;
  error?: string;
  to: string;
}

interface SendResponse {
  results: SendResult[];
  linkUrl: string;
  linkId: string;
  pdfFileName: string;
  fallback: boolean;
}

export function SendToClientModal({
  open,
  onClose,
  docType,
  recordId,
  recordNumber,
  defaultEmail,
  defaultWhatsapp,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  docType: SendDocType;
  recordId: string;
  recordNumber: string;
  defaultEmail?: string | null;
  defaultWhatsapp?: string | null;
  onSent?: () => void;
}) {
  const toast = useToast();
  const [emailOn, setEmailOn] = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState("");
  const [toWhatsapp, setToWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [allowCorrection, setAllowCorrection] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const label = DOC_TYPE_LABELS[docType] ?? docType;

  useEffect(() => {
    if (!open) return;
    setEmailOn(true);
    setWhatsappOn(Boolean(defaultWhatsapp) && !defaultEmail);
    setToEmail(defaultEmail ?? "");
    setCc("");
    setToWhatsapp(defaultWhatsapp ?? "");
    setMessage(
      `Dear Sir/Madam,\n\nPlease find attached the ${label} ${recordNumber} for your review and confirmation.\n\nRegards,\nTULSI ENGINEERS`,
    );
    setAttachPdf(true);
    setAllowCorrection(true);
    setBusy(false);
    setError(null);
    setResult(null);
    setCopied(false);
  }, [open, docType, recordNumber, defaultEmail, defaultWhatsapp, label]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const channels = [emailOn && "EMAIL", whatsappOn && "WHATSAPP"].filter(Boolean) as ("EMAIL" | "WHATSAPP")[];
    if (!channels.length) {
      setError("Select at least one channel to send on.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<SendResponse>(`/api/documents/${docType}/${recordId}/send`, {
        channels,
        toEmail: toEmail || undefined,
        cc: cc || undefined,
        toWhatsapp: toWhatsapp || undefined,
        message: message || undefined,
        attachPdf,
        allowCorrection,
      });
      setResult(res);
      toast.success("Sent to client");
      onSent?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!result?.linkUrl) return;
    try {
      await navigator.clipboard.writeText(result.linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send to client"
      description={`${label} ${recordNumber}`}
      size="md"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button form="send-to-client-form" type="submit" loading={busy}>
              Send
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          {result.results.map((r) => (
            <div key={r.channel} className="flex items-start gap-2 text-sm">
              {r.delivered ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : r.simulated ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <p className={r.delivered ? "text-green-700" : r.simulated ? "text-amber-700" : "text-red-700"}>
                <span className="font-medium">{r.channel === "EMAIL" ? "Email" : "WhatsApp"}</span>
                {r.to ? ` to ${r.to}` : ""} —{" "}
                {r.delivered
                  ? "accepted by Wapvio — delivery will be confirmed by WhatsApp"
                  : r.simulated
                    ? "recorded but not sent — configure WhatsApp/SMTP in Settings"
                    : (r.error ?? "could not be sent")}
              </p>
            </div>
          ))}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Client report link</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={result.linkUrl} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && <p className="mt-1 text-xs text-green-600">Copied to clipboard</p>}
          </div>
        </div>
      ) : (
        <form id="send-to-client-form" onSubmit={submit} noValidate className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex flex-wrap gap-4">
            <Checkbox label="Email" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
            <Checkbox label="WhatsApp" checked={whatsappOn} onChange={(e) => setWhatsappOn(e.target.checked)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="To email" hint={!emailOn ? "Only used when Email is selected" : undefined}>
              <Input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="contact@company.com" />
            </Field>
            <Field label="CC">
              <Input type="email" value={cc} onChange={(e) => setCc(e.target.value)} />
            </Field>
            <Field
              label="To WhatsApp number"
              hint={!whatsappOn ? "Only used when WhatsApp is selected" : undefined}
              className="sm:col-span-2"
            >
              <Input type="tel" inputMode="tel" value={toWhatsapp} onChange={(e) => setToWhatsapp(e.target.value)} placeholder="98250 11111" />
            </Field>
          </div>

          <Field label="Message">
            <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>

          <div className="space-y-2">
            <Checkbox label="Attach PDF" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
            <Checkbox
              label="Allow the client to request corrections"
              checked={allowCorrection}
              onChange={(e) => setAllowCorrection(e.target.checked)}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}

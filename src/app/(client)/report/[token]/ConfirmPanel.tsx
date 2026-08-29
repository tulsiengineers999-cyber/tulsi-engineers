"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, Printer, ShieldCheck, MessageSquare, Mail, CheckCircle2, RotateCw } from "lucide-react";
import { Button, Field, Input, Textarea, Alert, Spinner } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";

/* ── A tiny fetch wrapper, deliberately separate from @/lib/client-api ─────
   The shared `api` client redirects the browser to /login on any 401. This
   is a public, token-authenticated page with no login to bounce to — so we
   unwrap the same { success, data, error } envelope by hand instead. ──── */

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

class PortalApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function callApi<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new PortalApiError("Unable to reach the server. Please check your internet connection.", "NETWORK");
  }
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new PortalApiError("The server returned an unexpected response.", "BAD_RESPONSE");
  }
  if (!res.ok || !json.success) {
    throw new PortalApiError(json.error?.message ?? "Something went wrong. Please try again.", json.error?.code ?? "ERROR");
  }
  return json.data as T;
}

interface OtpResponse {
  otpId: string;
  maskedDestination: string;
  channel: "WHATSAPP" | "EMAIL";
  expiresInSeconds: number;
  devCode?: string;
  switched?: boolean;
  message?: string;
}

interface ConfirmResponse {
  status: string;
  clientName?: string | null;
  confirmedAt?: string | null;
  channel?: string | null;
  version: number;
}

type ConfirmStep = "form" | "requesting" | "code" | "verifying" | "done";

const RESEND_COOLDOWN_MS = 30_000;
const MAX_RESENDS = 3;

export function ConfirmPanel({
  token,
  documentLabel,
  confirmed,
  allowCorrection,
  correctionAlreadyRequested,
  recipientName,
  hasWhatsapp,
  hasEmail,
}: {
  token: string;
  documentLabel: string;
  confirmed: boolean;
  allowCorrection: boolean;
  correctionAlreadyRequested: boolean;
  recipientName?: string | null;
  hasWhatsapp: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();

  /* ── Confirm / OTP flow ─────────────────────────────────────────── */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState<ConfirmStep>("form");
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState(recipientName?.trim() ?? "");
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">(hasWhatsapp ? "WHATSAPP" : "EMAIL");
  const [otp, setOtp] = useState<OtpResponse | null>(null);
  const [switchedNotice, setSwitchedNotice] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(6).fill(""));
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendReadyAt, setResendReadyAt] = useState<number | null>(null);
  const [resendCount, setResendCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [receipt, setReceipt] = useState<ConfirmResponse | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step !== "code") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const resendWaitLeft = resendReadyAt ? Math.max(0, Math.ceil((resendReadyAt - now) / 1000)) : 0;

  function resetConfirmFlow() {
    setStep("form");
    setError(null);
    setOtp(null);
    setSwitchedNotice(null);
    setCodeDigits(Array(6).fill(""));
    setExpiresAt(null);
    setResendReadyAt(null);
    setResendCount(0);
    setReceipt(null);
  }

  function openConfirm() {
    resetConfirmFlow();
    setConfirmOpen(true);
  }

  async function requestCode(isResend: boolean) {
    setError(null);
    setStep("requesting");
    try {
      const res = await callApi<OtpResponse>(`/api/client/${token}/otp`, { channel });
      setOtp(res);
      setChannel(res.channel);
      setSwitchedNotice(res.message ?? null);
      setExpiresAt(Date.now() + res.expiresInSeconds * 1000);
      setResendReadyAt(Date.now() + RESEND_COOLDOWN_MS);
      setCodeDigits(Array(6).fill(""));
      if (isResend) setResendCount((c) => c + 1);
      setStep("code");
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    } catch (err) {
      setError(err instanceof PortalApiError ? err.message : "Something went wrong. Please try again.");
      setStep(isResend ? "code" : "form");
    }
  }

  async function verify(code: string) {
    if (!otp) return;
    setError(null);
    setStep("verifying");
    try {
      const res = await callApi<ConfirmResponse>(`/api/client/${token}/confirm`, {
        otpId: otp.otpId,
        code,
        clientName: clientName.trim() || undefined,
      });
      setReceipt(res);
      setStep("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof PortalApiError ? err.message : "Something went wrong. Please try again.");
      setCodeDigits(Array(6).fill(""));
      setStep("code");
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    }
  }

  // Auto-verify once all six boxes are filled.
  useEffect(() => {
    const code = codeDigits.join("");
    if (code.length === 6 && step === "code") {
      void verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeDigits]);

  function handleDigitChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setCodeDigits((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !codeDigits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setCodeDigits(next);
    inputRefs.current[Math.min(text.length, 6) - 1]?.focus();
  }

  /* ── Correction flow ────────────────────────────────────────────── */
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [correctionStep, setCorrectionStep] = useState<"idle" | "submitting" | "submitted">("idle");
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  function openCorrection() {
    setRemarks("");
    setCorrectionError(null);
    setCorrectionStep("idle");
    setCorrectionOpen(true);
  }

  async function submitCorrection() {
    if (remarks.trim().length < 5) {
      setCorrectionError("Please describe the correction needed (at least 5 characters).");
      return;
    }
    setCorrectionError(null);
    setCorrectionStep("submitting");
    try {
      await callApi(`/api/client/${token}/correction`, {
        remarks: remarks.trim(),
        clientName: clientName.trim() || undefined,
      });
      setCorrectionStep("submitted");
      router.refresh();
    } catch (err) {
      setCorrectionError(err instanceof PortalApiError ? err.message : "Something went wrong. Please try again.");
      setCorrectionStep("idle");
    }
  }

  const canRequest = hasWhatsapp || hasEmail;

  return (
    <>
      {/* Persistent action bar: fixed sheet on mobile, sticky rail on desktop */}
      <div
        className={clsx(
          "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 pb-safe no-print",
          "shadow-[0_-6px_16px_rgba(15,23,42,0.08)]",
          "lg:sticky lg:top-4 lg:inset-x-auto lg:bottom-auto lg:z-auto lg:rounded-xl lg:border lg:p-4 lg:shadow-sm",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 lg:mx-0 lg:max-w-none lg:flex-col lg:items-stretch">
          <a
            href={`/api/client/${token}/pdf?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="te-focus flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:h-11 lg:w-full lg:flex-none"
          >
            <Download className="h-4 w-4" /> Download PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="te-focus flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:h-11 lg:w-full lg:flex-none"
          >
            <Printer className="h-4 w-4" /> Print
          </button>

          {confirmed ? (
            <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-green-50 text-sm font-semibold text-green-700 lg:h-11 lg:w-full lg:flex-none">
              <CheckCircle2 className="h-4 w-4" /> Confirmed
            </div>
          ) : (
            <button
              type="button"
              onClick={openConfirm}
              disabled={!canRequest}
              className="te-focus flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-[var(--te-primary)] text-sm font-semibold text-white hover:bg-[var(--te-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50 lg:h-11 lg:w-full lg:flex-none"
            >
              <ShieldCheck className="h-4 w-4" /> Confirm this report
            </button>
          )}
        </div>

        {!confirmed && allowCorrection && (
          <div className="mx-auto mt-2 max-w-3xl lg:mx-0 lg:mt-3 lg:max-w-none">
            <button
              type="button"
              onClick={openCorrection}
              className="te-focus w-full text-center text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 lg:text-left"
            >
              {correctionAlreadyRequested ? "Send another correction request" : "Something not right? Request a correction"}
            </button>
          </div>
        )}
      </div>

      {/* Confirm / OTP modal */}
      <Modal
        open={confirmOpen}
        onClose={() => (step === "verifying" || step === "requesting" ? undefined : setConfirmOpen(false))}
        title={step === "done" ? "Report confirmed" : `Confirm ${documentLabel}`}
        description={step === "done" ? undefined : "We'll send a one-time code to verify it's really you."}
        size="sm"
      >
        {step === "form" && (
          <div className="space-y-4">
            <Field label="Your name" hint="shown on the confirmation record">
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter your full name"
                className="h-12 text-base"
              />
            </Field>

            {hasWhatsapp && hasEmail && (
              <Field label="Send the code by">
                <div className="grid grid-cols-2 gap-2">
                  <ChannelButton active={channel === "WHATSAPP"} icon={MessageSquare} label="WhatsApp" onClick={() => setChannel("WHATSAPP")} />
                  <ChannelButton active={channel === "EMAIL"} icon={Mail} label="Email" onClick={() => setChannel("EMAIL")} />
                </div>
              </Field>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <Button size="lg" className="h-12 w-full" onClick={() => requestCode(false)}>
              Send verification code
            </Button>
          </div>
        )}

        {step === "requesting" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner />
            <p className="text-sm text-slate-500">Sending your code…</p>
          </div>
        )}

        {(step === "code" || step === "verifying") && otp && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Code sent to <b className="text-slate-800">{otp.maskedDestination}</b> via {otp.channel === "WHATSAPP" ? "WhatsApp" : "email"}.
            </p>
            {switchedNotice && <Alert tone="warning">{switchedNotice}</Alert>}
            {otp.devCode && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <b>Development only</b> — code: <span className="font-mono text-sm">{otp.devCode}</span>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-700 uppercase">Enter 6-digit code</p>
              <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handlePaste}>
                {codeDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    disabled={step === "verifying"}
                    className="te-focus h-14 w-full min-w-0 rounded-md border border-slate-300 text-center text-xl font-semibold text-slate-900 disabled:bg-slate-50"
                  />
                ))}
              </div>
            </div>

            {step === "verifying" && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Spinner className="h-4 w-4" /> Verifying…
              </div>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{secondsLeft > 0 ? `Code expires in ${formatSeconds(secondsLeft)}` : "Code has expired"}</span>
              {resendCount < MAX_RESENDS && (
                <button
                  type="button"
                  disabled={resendWaitLeft > 0 || step === "verifying"}
                  onClick={() => requestCode(true)}
                  className="te-focus font-semibold text-[var(--te-primary)] underline underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  {resendWaitLeft > 0 ? `Resend in ${resendWaitLeft}s` : "Resend code"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "done" && receipt && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-base font-semibold text-slate-900">Thank you, {receipt.clientName || "confirmed"}!</p>
            <p className="text-sm text-slate-600">
              This report is now confirmed as version {receipt.version} — verified by one-time code.
            </p>
            <Button size="lg" className="mt-2 h-12 w-full" onClick={() => setConfirmOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* Correction request modal */}
      <Modal open={correctionOpen} onClose={() => setCorrectionOpen(false)} title="Request a correction" size="sm">
        {correctionStep === "submitted" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="rounded-full bg-blue-100 p-3">
              <RotateCw className="h-7 w-7 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Your request has been sent</p>
            <p className="text-sm text-slate-600">TULSI ENGINEERS will review it and get back to you with an updated report.</p>
            <Button size="lg" className="mt-2 h-12 w-full" onClick={() => setCorrectionOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="What needs to be corrected?" required error={correctionError ?? undefined}>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                className="text-base"
                placeholder="Describe what is incorrect or missing…"
              />
            </Field>
            <Field label="Your name" hint="optional">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-12 text-base" />
            </Field>
            <Button
              size="lg"
              className="h-12 w-full"
              loading={correctionStep === "submitting"}
              onClick={submitCorrection}
            >
              Send correction request
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

function ChannelButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "te-focus flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold",
        active ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowLeft } from "lucide-react";
import { Button, Field, Input, Alert } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-full bg-green-100">
          <MailCheck className="h-6 w-6 text-green-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          If an active account exists for <b>{email}</b>, a password reset link is on its way. The link expires in
          60 minutes.
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--te-primary)] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Forgot password</h2>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Enter your registered email address and we&apos;ll send you a reset link.
      </p>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address" required>
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@tulsiengineers.com"
          />
        </Field>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Send reset link
        </Button>
      </form>

      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[var(--te-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}

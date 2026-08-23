"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Field, Input, Alert, LoadingBlock } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client-api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div>
        <Alert tone="danger" title="Invalid reset link">
          This link is missing its security token. Please request a new password reset.
        </Alert>
        <Link href="/forgot-password" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--te-primary)] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Request a new link
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/reset-password", { token, password, confirmPassword });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset the password.");
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Set a new password</h2>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Choose a password of at least 8 characters containing letters and numbers.
      </p>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" required>
          <Input type="password" required autoFocus minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Reset password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ResetForm />
    </Suspense>
  );
}

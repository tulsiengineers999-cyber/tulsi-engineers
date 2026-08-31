"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button, Field, Input, Alert } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client-api";

export function LoginForm({ next, justReset }: { next?: string; justReset?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ redirectTo: string; mustChangePassword: boolean }>("/api/auth/login", {
        email,
        password,
      });
      const target = res.mustChangePassword ? "/account/password" : (next ?? res.redirectTo);
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
      <p className="mt-1 mb-6 text-sm text-slate-500">Use your work email or username to continue.</p>

      {justReset && (
        <Alert tone="success" className="mb-4">
          Your password has been reset. Please sign in with your new password.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email or username" required>
          <Input
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@tulsiengineers.com"
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="te-focus absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-medium text-[var(--te-primary)] hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {!busy && <LogIn className="h-4 w-4" />} Sign in
        </Button>
      </form>

    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Field, Input, Alert } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "Contains a number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Does not start or end with a space", test: (p: string) => p.length > 0 && !/^\s|\s$/.test(p) },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [forced, setForced] = useState(false);
  const [values, setValues] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ mustChangePassword: boolean }>("/api/auth/me")
      .then((u) => setForced(u.mustChangePassword))
      .catch(() => setForced(false));
  }, []);

  const passed = RULES.map((r) => r.test(values.password));
  const allPassed = passed.every(Boolean);
  const matches = values.password.length > 0 && values.password === values.confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/change-password", values);
      toast.success("Password updated", "Use your new password the next time you sign in.");
      setValues({ currentPassword: "", password: "", confirmPassword: "" });
      setForced(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Change password"
        description="Choose something you have not used elsewhere."
        crumbs={[{ label: "My account" }, { label: "Change password" }]}
      />

      {forced && (
        <Alert tone="warning" title="A new password is required" className="mb-4">
          Your account is using a temporary password issued by an administrator. Choose your own password now — you
          will not be able to continue until you do.
        </Alert>
      )}

      <Card>
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Current password" required>
            <Input
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={values.currentPassword}
              onChange={(e) => setValues((v) => ({ ...v, currentPassword: e.target.value }))}
            />
          </Field>

          <Field label="New password" required>
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={values.password}
              onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
            />
          </Field>

          <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {RULES.map((r, i) => (
              <li key={r.label} className="flex items-center gap-2 text-xs">
                {values.password && passed[i] ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : (
                  <X className={`h-3.5 w-3.5 shrink-0 ${values.password ? "text-red-400" : "text-slate-300"}`} />
                )}
                <span className={values.password && passed[i] ? "text-green-700" : "text-slate-500"}>{r.label}</span>
              </li>
            ))}
          </ul>

          <Field
            label="Confirm new password"
            required
            error={values.confirmPassword && !matches ? "The two passwords do not match." : undefined}
          >
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={values.confirmPassword}
              onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
            />
          </Field>

          <Button type="submit" size="lg" loading={busy} disabled={!allPassed || !matches} className="w-full">
            {!busy && <KeyRound className="h-4 w-4" />} Update password
          </Button>

          <p className="text-center text-xs text-slate-500">
            Changing your password does not sign you out of this device.
          </p>
        </form>
      </Card>
    </div>
  );
}

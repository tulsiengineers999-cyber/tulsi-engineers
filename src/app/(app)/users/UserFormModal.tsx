"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Checkbox, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";

export interface UserFormValues {
  id?: string;
  name: string;
  email: string;
  username: string;
  employeeCode: string;
  mobile: string;
  whatsapp: string;
  designation: string;
  department: string;
  roleId: string;
  isEngineer: boolean;
  isTechnician: boolean;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  mustChangePassword: boolean;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
}

const EMPTY: UserFormValues = {
  name: "", email: "", username: "", employeeCode: "", mobile: "", whatsapp: "",
  designation: "", department: "", roleId: "", isEngineer: false, isTechnician: false,
  status: "ACTIVE", mustChangePassword: false,
};

export function UserFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  initial?: Partial<UserFormValues> & { id?: string };
}) {
  const toast = useToast();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [values, setValues] = useState<UserFormValues>(EMPTY);
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initial } as UserFormValues);
      setPassword("");
      setResetPassword(false);
      setErrors({});
      setFormError(null);
      setRevealedPassword(null);
      setSavedId(null);
      api.get<RoleOption[]>("/api/roles").then(setRoles).catch(() => undefined);
    }
  }, [open, initial]);

  const set = (k: keyof UserFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const setBool = (k: "isEngineer" | "isTechnician" | "mustChangePassword") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.checked }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = {
        ...values,
        password: !isEdit || resetPassword ? password : undefined,
      };
      const saved = isEdit
        ? await api.put<{ id: string; name: string; temporaryPassword?: string }>(`/api/users/${initial!.id}`, payload)
        : await api.post<{ id: string; name: string; temporaryPassword?: string }>("/api/users", payload);

      if (saved.temporaryPassword) {
        setSavedId(saved.id);
        setRevealedPassword(saved.temporaryPassword);
      } else {
        toast.success(isEdit ? "User updated" : "User created", values.name);
        onSaved(saved.id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setFormError(err.fields ? null : err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      toast.success("Password copied to clipboard");
    } catch {
      toast.error("Could not copy. Please select and copy manually.");
    }
  };

  const finishReveal = () => {
    if (savedId) onSaved(savedId);
  };

  if (revealedPassword) {
    return (
      <Modal
        open={open}
        onClose={finishReveal}
        title="Temporary password generated"
        size="sm"
        footer={<Button onClick={finishReveal}>Done</Button>}
      >
        <div className="space-y-4">
          <Alert tone="warning" title="This will not be shown again">
            Share it with {values.name} through a secure channel and ask them to sign in and change it immediately.
          </Alert>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-center font-mono text-base tracking-widest text-slate-800">
              {revealedPassword}
            </code>
            <Button type="button" variant="outline" onClick={copyPassword}>
              Copy
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "New User"}
      description="Users sign in with their email address and are governed by their assigned role's permissions."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button form="user-form" type="submit" loading={busy}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div>
          <SectionTitle>Profile</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name} className="sm:col-span-2">
              <Input value={values.name} onChange={set("name")} required autoFocus placeholder="Rakesh Shah" />
            </Field>
            <Field label="Employee code" error={errors.employeeCode}>
              <Input value={values.employeeCode} onChange={set("employeeCode")} placeholder="TE-006" />
            </Field>
            <Field label="Designation" error={errors.designation}>
              <Input value={values.designation} onChange={set("designation")} placeholder="Service Engineer" />
            </Field>
            <Field label="Department" error={errors.department}>
              <Input value={values.department} onChange={set("department")} placeholder="Field Service" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Sign-in &amp; contact</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email}>
              <Input value={values.email} onChange={set("email")} type="email" required placeholder="name@tulsiengineers.com" />
            </Field>
            <Field label="Username" error={errors.username} hint="optional — email works too">
              <Input value={values.username} onChange={set("username")} placeholder="rakesh" />
            </Field>
            <Field label="Mobile" error={errors.mobile}>
              <Input value={values.mobile} onChange={set("mobile")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
            <Field label="WhatsApp number" error={errors.whatsapp}>
              <Input value={values.whatsapp} onChange={set("whatsapp")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Role &amp; access</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" required error={errors.roleId}>
              <Select value={values.roleId} onChange={set("roleId")} required>
                <option value="">Select a role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status" error={errors.status}>
              <Select value={values.status} onChange={set("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="LOCKED">Locked</option>
              </Select>
            </Field>
            <div className="flex flex-col justify-center gap-2 sm:col-span-2">
              <Checkbox label="Engineer" description="Appears in the field engineer directory and job assignment lists" checked={values.isEngineer} onChange={setBool("isEngineer")} />
              <Checkbox label="Technician" description="Appears in the field technician directory and job assignment lists" checked={values.isTechnician} onChange={setBool("isTechnician")} />
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Password</SectionTitle>
          {isEdit && (
            <Checkbox
              className="mb-3"
              label="Set a new password"
              description="Leave unchecked to keep the current password unchanged"
              checked={resetPassword}
              onChange={(e) => { setResetPassword(e.target.checked); if (!e.target.checked) setPassword(""); }}
            />
          )}
          {(!isEdit || resetPassword) && (
            <Field
              label="Password"
              error={errors.password}
              hint="leave blank to auto-generate a temporary password"
            >
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} placeholder="At least 8 characters" />
            </Field>
          )}
          <Checkbox
            className="mt-3"
            label="Require password change at next sign-in"
            checked={values.mustChangePassword}
            onChange={setBool("mustChangePassword")}
          />
        </div>
      </form>
    </Modal>
  );
}

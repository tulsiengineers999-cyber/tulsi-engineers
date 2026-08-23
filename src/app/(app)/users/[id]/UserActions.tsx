"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, KeyRound, LogOut, Trash2, Copy, Check, Power } from "lucide-react";
import { Button, Alert } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { UserFormModal, type UserFormValues } from "../UserFormModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export interface UserActionPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
}

export function UserActions({
  user,
  isSelf,
  permissions,
}: {
  user: UserFormValues & { id: string };
  isSelf: boolean;
  permissions: UserActionPermissions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetPassword = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ temporaryPassword: string }>(`/api/users/${user.id}/reset-password`);
      setTempPassword(res.temporaryPassword);
      setResetOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not reset the password", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const revokeSessions = async () => {
    setBusy(true);
    try {
      const res = await api.del<{ revoked: number }>(`/api/users/${user.id}/sessions`);
      toast.success("Sessions revoked", `${res.revoked} active session(s) signed out.`);
      setRevokeOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not revoke sessions", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    const next = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusy(true);
    try {
      await api.put(`/api/users/${user.id}`, { ...user, status: next });
      toast.success(next === "ACTIVE" ? "User activated" : "User deactivated");
      router.refresh();
    } catch (err) {
      toast.error("Could not change the account status", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/users/${user.id}`);
      toast.success("User deleted");
      router.push("/users");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete this user", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  const copy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.warning("Copy failed", "Please select the password and copy it manually.");
    }
  };

  return (
    <>
      <div className="grid gap-2">
        {permissions.canEdit && (
          <Button variant="primary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit user
          </Button>
        )}
        {permissions.canManage && (
          <>
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <KeyRound className="h-4 w-4" /> Reset password
            </Button>
            <Button variant="outline" onClick={() => setRevokeOpen(true)}>
              <LogOut className="h-4 w-4" /> Revoke all sessions
            </Button>
          </>
        )}
        {permissions.canEdit && !isSelf && (
          <Button variant="ghost" onClick={toggleStatus} loading={busy}>
            <Power className="h-4 w-4" /> {user.status === "ACTIVE" ? "Deactivate account" : "Activate account"}
          </Button>
        )}
        {permissions.canDelete && !isSelf && (
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Delete user
          </Button>
        )}
        {isSelf && (
          <p className="text-xs text-slate-500">
            This is your own account, so deactivation and deletion are disabled here.
          </p>
        )}
      </div>

      <UserFormModal
        open={editOpen}
        initial={user}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        loading={busy}
        tone="primary"
        onClose={() => setResetOpen(false)}
        onConfirm={resetPassword}
        title="Reset this user's password?"
        confirmLabel="Generate temporary password"
        message={
          <>
            A new temporary password will be generated for <b>{user.name}</b> and shown to you once. Their existing
            sessions will be signed out and they will be asked to choose a new password at their next sign-in.
          </>
        }
      />

      <ConfirmDialog
        open={revokeOpen}
        loading={busy}
        tone="primary"
        onClose={() => setRevokeOpen(false)}
        onConfirm={revokeSessions}
        title="Sign this user out everywhere?"
        confirmLabel="Revoke sessions"
        message={
          <>
            <b>{user.name}</b> will be signed out on every device immediately. Their password is not changed.
          </>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        loading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this user?"
        confirmLabel="Delete user"
        message={
          <>
            <b>{user.name}</b> will no longer be able to sign in and will disappear from lists. Jobs, reports and
            audit entries they created are kept intact for the record.
          </>
        }
      />

      <Modal
        open={Boolean(tempPassword)}
        onClose={() => setTempPassword(null)}
        title="Temporary password"
        description="Share this with the user through a secure channel."
        size="sm"
        footer={
          <Button onClick={() => setTempPassword(null)}>I have saved it</Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning" title="This will not be shown again">
            The password is stored only as a secure hash. If you lose it, generate a new one.
          </Alert>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-base tracking-wide text-slate-900 select-all">
              {tempPassword}
            </code>
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy password">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {user.name} will be asked to set their own password the first time they sign in.
          </p>
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { CustomerFormModal, type CustomerFormValues } from "../CustomerFormModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export function CustomerActions({ customer }: { customer: CustomerFormValues & { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/customers/${customer.id}`);
      toast.success("Customer deleted");
      router.push("/customers");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete customer", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
      <Button variant="outline" onClick={() => setConfirmOpen(true)} className="text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>

      <CustomerFormModal
        open={editOpen}
        initial={customer}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); router.refresh(); }}
      />

      <ConfirmDialog
        open={confirmOpen}
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        title="Delete this customer?"
        confirmLabel="Delete customer"
        message={
          <>
            <b>{customer.companyName}</b> will be removed from lists and searches. Sites, equipment and any linked
            records are kept for audit purposes. Customers with existing service jobs cannot be deleted — set them to
            Inactive instead.
          </>
        }
      />
    </>
  );
}

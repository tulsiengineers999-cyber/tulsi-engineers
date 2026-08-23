"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { SiteFormModal, type SiteFormValues } from "../SiteFormModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface SiteDetail {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  contactPerson: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  siteType: string | null;
  remarks: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export function SiteActions({ site }: { site: SiteDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const initial: Partial<SiteFormValues> & { id: string } = {
    id: site.id,
    customerId: site.customerId,
    name: site.name,
    address: site.address ?? "",
    city: site.city ?? "",
    state: site.state ?? "",
    pinCode: site.pinCode ?? "",
    contactPerson: site.contactPerson ?? "",
    mobile: site.mobile ?? "",
    whatsapp: site.whatsapp ?? "",
    email: site.email ?? "",
    latitude: site.latitude != null ? String(site.latitude) : "",
    longitude: site.longitude != null ? String(site.longitude) : "",
    siteType: site.siteType ?? "",
    remarks: site.remarks ?? "",
    status: site.status,
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/sites/${site.id}`);
      toast.success("Site deleted");
      router.push("/sites");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete site", err instanceof ApiError ? err.message : undefined);
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

      <SiteFormModal
        open={editOpen}
        initial={initial}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); router.refresh(); }}
      />

      <ConfirmDialog
        open={confirmOpen}
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        title="Delete this site?"
        confirmLabel="Delete site"
        message={
          <>
            <b>{site.name}</b> will be removed from lists and searches. Equipment and any linked records are kept
            for audit purposes. Sites with existing service jobs cannot be deleted — set the site to Inactive instead.
          </>
        }
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EquipmentFormModal, type EquipmentFormValues } from "../EquipmentFormModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateInput } from "@/lib/format";

interface EquipmentDetail {
  id: string;
  customerId: string;
  siteId: string;
  type: string;
  typeOther: string | null;
  name: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  fuelType: string | null;
  installationDate: string | null;
  commissioningDate: string | null;
  warrantyUpto: string | null;
  amcStatus: string;
  amcValidUpto: string | null;
  specifications: Record<string, string> | null;
  remarks: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export function EquipmentActions({ equipment }: { equipment: EquipmentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const initial: Partial<EquipmentFormValues> & { id: string } = {
    id: equipment.id,
    customerId: equipment.customerId,
    siteId: equipment.siteId,
    type: equipment.type,
    typeOther: equipment.typeOther ?? "",
    name: equipment.name,
    make: equipment.make ?? "",
    model: equipment.model ?? "",
    serialNumber: equipment.serialNumber ?? "",
    capacity: equipment.capacity ?? "",
    fuelType: equipment.fuelType ?? "",
    installationDate: formatDateInput(equipment.installationDate),
    commissioningDate: formatDateInput(equipment.commissioningDate),
    warrantyUpto: formatDateInput(equipment.warrantyUpto),
    amcStatus: equipment.amcStatus,
    amcValidUpto: formatDateInput(equipment.amcValidUpto),
    specifications: equipment.specifications ?? {},
    remarks: equipment.remarks ?? "",
    status: equipment.status,
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/equipment/${equipment.id}`);
      toast.success("Equipment deleted");
      router.push("/equipment");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete equipment", err instanceof ApiError ? err.message : undefined);
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

      <EquipmentFormModal
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
        title="Delete this equipment?"
        confirmLabel="Delete equipment"
        message={
          <>
            <b>{equipment.name}</b> will be removed from lists and searches. Photos and any linked records are kept
            for audit purposes. Equipment with existing service jobs cannot be deleted — set it to Inactive instead.
          </>
        }
      />
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Textarea, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { formatDateInput } from "@/lib/format";
import { EQUIPMENT_TYPE_LABELS, AMC_STATUS_LABELS } from "@/lib/masters";

interface CustomerOption {
  id: string;
  code: string;
  companyName: string;
}

interface SiteOption {
  id: string;
  name: string;
  customerId: string;
}

export interface EquipmentFormValues {
  id?: string;
  customerId: string;
  siteId: string;
  type: string;
  typeOther: string;
  name: string;
  make: string;
  model: string;
  serialNumber: string;
  capacity: string;
  fuelType: string;
  installationDate: string;
  commissioningDate: string;
  warrantyUpto: string;
  amcStatus: string;
  amcValidUpto: string;
  specifications: Record<string, string>;
  remarks: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY: EquipmentFormValues = {
  customerId: "", siteId: "", type: "OTHER", typeOther: "", name: "", make: "", model: "",
  serialNumber: "", capacity: "", fuelType: "", installationDate: "", commissioningDate: "",
  warrantyUpto: "", amcStatus: "NOT_UNDER_AMC", amcValidUpto: "", specifications: {}, remarks: "",
  status: "ACTIVE",
};

export function EquipmentFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  initial?: Partial<EquipmentFormValues> & { id?: string };
}) {
  const toast = useToast();
  const [values, setValues] = useState<EquipmentFormValues>(EMPTY);
  const [specRows, setSpecRows] = useState<{ key: string; value: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);

  useEffect(() => {
    if (open) {
      const merged = { ...EMPTY, ...initial } as EquipmentFormValues;
      setValues(merged);
      setSpecRows(
        Object.entries(merged.specifications ?? {}).map(([key, value]) => ({ key, value: String(value) })),
      );
      setErrors({});
      setFormError(null);
      api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    api
      .get<SiteOption[]>(`/api/sites/options${qs({ customerId: values.customerId })}`)
      .then(setSites)
      .catch(() => undefined);
  }, [open, values.customerId]);

  const set = (k: keyof EquipmentFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const setCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    setValues((v) => ({ ...v, customerId, siteId: v.customerId === customerId ? v.siteId : "" }));
  };

  const addSpecRow = () => setSpecRows((rows) => [...rows, { key: "", value: "" }]);
  const removeSpecRow = (index: number) => setSpecRows((rows) => rows.filter((_, i) => i !== index));
  const updateSpecRow = (index: number, field: "key" | "value", val: string) =>
    setSpecRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: val } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const specifications: Record<string, string> = {};
      for (const row of specRows) {
        const key = row.key.trim();
        if (key) specifications[key] = row.value.trim();
      }
      const payload = { ...values, specifications };
      const saved = initial?.id
        ? await api.put<{ id: string }>(`/api/equipment/${initial.id}`, payload)
        : await api.post<{ id: string }>("/api/equipment", payload);
      toast.success(initial?.id ? "Equipment updated" : "Equipment created", values.name);
      onSaved(saved.id);
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Edit Equipment" : "New Equipment"}
      description="Equipment belongs to one site and is used when logging service jobs."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button form="equipment-form" type="submit" loading={busy}>
            {initial?.id ? "Save changes" : "Create equipment"}
          </Button>
        </>
      }
    >
      <form id="equipment-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div>
          <SectionTitle>Location</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" required error={errors.customerId}>
              <Select value={values.customerId} onChange={setCustomer} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Site" required error={errors.siteId} hint={!values.customerId ? "Select a customer first" : undefined}>
              <Select value={values.siteId} onChange={set("siteId")} required disabled={!values.customerId}>
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Equipment details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Equipment name" required error={errors.name} className="sm:col-span-2">
              <Input value={values.name} onChange={set("name")} required autoFocus placeholder="2 TPH Steam Boiler" />
            </Field>
            <Field label="Equipment type" error={errors.type}>
              <Select value={values.type} onChange={set("type")}>
                {Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            {values.type === "OTHER" && (
              <Field label="Specify type" error={errors.typeOther}>
                <Input value={values.typeOther} onChange={set("typeOther")} placeholder="e.g. Economiser" />
              </Field>
            )}
            <Field label="Make" error={errors.make}>
              <Input value={values.make} onChange={set("make")} placeholder="Thermax" />
            </Field>
            <Field label="Model" error={errors.model}>
              <Input value={values.model} onChange={set("model")} />
            </Field>
            <Field label="Serial number" error={errors.serialNumber}>
              <Input value={values.serialNumber} onChange={set("serialNumber")} />
            </Field>
            <Field label="Capacity" error={errors.capacity}>
              <Input value={values.capacity} onChange={set("capacity")} placeholder="2000 kg/hr" />
            </Field>
            <Field label="Fuel type" error={errors.fuelType}>
              <Input value={values.fuelType} onChange={set("fuelType")} placeholder="Briquette / Gas / HSD" />
            </Field>
            <Field label="Status" error={errors.status}>
              <Select value={values.status} onChange={set("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Dates &amp; AMC</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Installation date" error={errors.installationDate}>
              <Input type="date" value={formatDateInput(values.installationDate)} onChange={set("installationDate")} />
            </Field>
            <Field label="Commissioning date" error={errors.commissioningDate}>
              <Input type="date" value={formatDateInput(values.commissioningDate)} onChange={set("commissioningDate")} />
            </Field>
            <Field label="Warranty upto" error={errors.warrantyUpto}>
              <Input type="date" value={formatDateInput(values.warrantyUpto)} onChange={set("warrantyUpto")} />
            </Field>
            <Field label="AMC status" error={errors.amcStatus}>
              <Select value={values.amcStatus} onChange={set("amcStatus")}>
                {Object.entries(AMC_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="AMC valid upto" error={errors.amcValidUpto}>
              <Input type="date" value={formatDateInput(values.amcValidUpto)} onChange={set("amcValidUpto")} />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Specifications</SectionTitle>
          <div className="space-y-2">
            {specRows.length === 0 && <p className="text-xs text-slate-500">No specifications added yet.</p>}
            {specRows.map((row, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => updateSpecRow(i, "key", e.target.value)}
                  placeholder="Design Pressure"
                  className="flex-1"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateSpecRow(i, "value", e.target.value)}
                  placeholder="10.54 kg/cm²"
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSpecRow(i)} aria-label="Remove specification">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSpecRow}>
              <Plus className="h-4 w-4" /> Add specification
            </Button>
          </div>
        </div>

        <Field label="Remarks" error={errors.remarks}>
          <Textarea value={values.remarks} onChange={set("remarks")} rows={2} placeholder="Additional notes…" />
        </Field>
      </form>
    </Modal>
  );
}

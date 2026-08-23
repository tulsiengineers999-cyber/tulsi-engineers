"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Textarea, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { formatDateInput } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/masters";

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

interface EquipmentOption {
  id: string;
  name: string;
  serialNumber: string | null;
  siteId: string;
}

interface ServiceTypeOption {
  id: string;
  name: string;
  category: string | null;
}

export interface JobFormValues {
  id?: string;
  customerId: string;
  siteId: string;
  equipmentId: string;
  serviceTypeId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requestDate: string;
  plannedVisitDate: string;
  targetCompletionDate: string;
  customerRequirement: string;
  problemDescription: string;
  jobDescription: string;
  requiredMaterial: string;
  requiredSpare: string;
  remarks: string;
}

const EMPTY: JobFormValues = {
  customerId: "", siteId: "", equipmentId: "", serviceTypeId: "", priority: "MEDIUM",
  requestDate: "", plannedVisitDate: "", targetCompletionDate: "", customerRequirement: "",
  problemDescription: "", jobDescription: "", requiredMaterial: "", requiredSpare: "", remarks: "",
};

export function JobFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  initial?: Partial<JobFormValues> & { id?: string };
}) {
  const toast = useToast();
  const [values, setValues] = useState<JobFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initial } as JobFormValues);
      setErrors({});
      setFormError(null);
      api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
      api.get<ServiceTypeOption[]>("/api/service-types/options").then(setServiceTypes).catch(() => undefined);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    api
      .get<SiteOption[]>(`/api/sites/options${qs({ customerId: values.customerId })}`)
      .then(setSites)
      .catch(() => undefined);
  }, [open, values.customerId]);

  useEffect(() => {
    if (!open || !values.siteId) {
      setEquipment([]);
      return;
    }
    api
      .get<EquipmentOption[]>(`/api/equipment/options${qs({ siteId: values.siteId })}`)
      .then(setEquipment)
      .catch(() => undefined);
  }, [open, values.siteId]);

  const set = (k: keyof JobFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const setCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    setValues((v) => ({
      ...v,
      customerId,
      siteId: v.customerId === customerId ? v.siteId : "",
      equipmentId: v.customerId === customerId ? v.equipmentId : "",
    }));
  };

  const setSite = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = e.target.value;
    setValues((v) => ({ ...v, siteId, equipmentId: v.siteId === siteId ? v.equipmentId : "" }));
  };

  const grouped = serviceTypes.reduce<Record<string, ServiceTypeOption[]>>((acc, s) => {
    const key = s.category ?? "Other";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = { ...values };
      const saved = initial?.id
        ? await api.put<{ id: string }>(`/api/jobs/${initial.id}`, payload)
        : await api.post<{ id: string }>("/api/jobs", payload);
      toast.success(initial?.id ? "Job updated" : "Job created");
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
      title={initial?.id ? "Edit Service Job" : "New Service Job"}
      description="A service job links a customer, site and (optionally) equipment to the work being carried out."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button form="job-form" type="submit" loading={busy}>
            {initial?.id ? "Save changes" : "Create job"}
          </Button>
        </>
      }
    >
      <form id="job-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div>
          <SectionTitle>Where</SectionTitle>
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
              <Select value={values.siteId} onChange={setSite} required disabled={!values.customerId}>
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment" error={errors.equipmentId} hint={!values.siteId ? "Select a site first" : "Optional"}>
              <Select value={values.equipmentId} onChange={set("equipmentId")} disabled={!values.siteId}>
                <option value="">Not specific to one equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.name}{eq.serialNumber ? ` (Sr. ${eq.serialNumber})` : ""}</option>
                ))}
              </Select>
            </Field>
            <Field label="Service type" required error={errors.serviceTypeId}>
              <Select value={values.serviceTypeId} onChange={set("serviceTypeId")} required>
                <option value="">Select service type</option>
                {Object.entries(grouped).map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>When</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Priority" error={errors.priority}>
              <Select value={values.priority} onChange={set("priority")}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Request date" error={errors.requestDate}>
              <Input type="date" value={formatDateInput(values.requestDate)} onChange={set("requestDate")} />
            </Field>
            <Field label="Planned visit date" error={errors.plannedVisitDate}>
              <Input type="date" value={formatDateInput(values.plannedVisitDate)} onChange={set("plannedVisitDate")} />
            </Field>
            <Field label="Target completion date" error={errors.targetCompletionDate}>
              <Input type="date" value={formatDateInput(values.targetCompletionDate)} onChange={set("targetCompletionDate")} />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>What</SectionTitle>
          <div className="grid gap-4">
            <Field label="Customer's requirement" error={errors.customerRequirement}>
              <Textarea value={values.customerRequirement} onChange={set("customerRequirement")} rows={2} placeholder="What the customer has asked for…" />
            </Field>
            <Field label="Problem description" error={errors.problemDescription}>
              <Textarea value={values.problemDescription} onChange={set("problemDescription")} rows={2} placeholder="Reported symptoms / fault…" />
            </Field>
            <Field label="Job description" error={errors.jobDescription}>
              <Textarea value={values.jobDescription} onChange={set("jobDescription")} rows={2} placeholder="Scope of work to be carried out…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Material required" error={errors.requiredMaterial}>
                <Textarea value={values.requiredMaterial} onChange={set("requiredMaterial")} rows={2} />
              </Field>
              <Field label="Spares required" error={errors.requiredSpare}>
                <Textarea value={values.requiredSpare} onChange={set("requiredSpare")} rows={2} />
              </Field>
            </div>
            <Field label="Remarks" error={errors.remarks}>
              <Textarea value={values.remarks} onChange={set("remarks")} rows={2} />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}

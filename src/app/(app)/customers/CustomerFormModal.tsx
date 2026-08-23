"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Textarea, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";

export interface CustomerFormValues {
  id?: string;
  companyName: string;
  contactPerson: string;
  department: string;
  designation: string;
  mobile: string;
  whatsapp: string;
  email: string;
  altEmail: string;
  gstNumber: string;
  industry: string;
  billingAddress: string;
  city: string;
  state: string;
  pinCode: string;
  status: "ACTIVE" | "INACTIVE";
  remarks: string;
}

const EMPTY: CustomerFormValues = {
  companyName: "", contactPerson: "", department: "", designation: "", mobile: "", whatsapp: "",
  email: "", altEmail: "", gstNumber: "", industry: "", billingAddress: "", city: "",
  state: "Gujarat", pinCode: "", status: "ACTIVE", remarks: "",
};

export function CustomerFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  initial?: Partial<CustomerFormValues> & { id?: string };
}) {
  const toast = useToast();
  const [values, setValues] = useState<CustomerFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initial } as CustomerFormValues);
      setErrors({});
      setFormError(null);
    }
  }, [open, initial]);

  const set = (k: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = { ...values };
      const saved = initial?.id
        ? await api.put<{ id: string }>(`/api/customers/${initial.id}`, payload)
        : await api.post<{ id: string }>("/api/customers", payload);
      toast.success(initial?.id ? "Customer updated" : "Customer created", values.companyName);
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
      title={initial?.id ? "Edit Customer" : "New Customer"}
      description="A customer can have multiple contacts, sites, equipment and service jobs."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button form="customer-form" type="submit" loading={busy}>
            {initial?.id ? "Save changes" : "Create customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div>
          <SectionTitle>Company</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required error={errors.companyName} className="sm:col-span-2">
              <Input value={values.companyName} onChange={set("companyName")} required autoFocus placeholder="ABC Industries Pvt. Ltd." />
            </Field>
            <Field label="Industry" error={errors.industry}>
              <Input value={values.industry} onChange={set("industry")} placeholder="Textile Processing" />
            </Field>
            <Field label="GST number" error={errors.gstNumber} hint="15 characters">
              <Input value={values.gstNumber} onChange={set("gstNumber")} placeholder="24AABCA1234A1Z5" maxLength={15} className="uppercase" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Primary contact</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person" error={errors.contactPerson}>
              <Input value={values.contactPerson} onChange={set("contactPerson")} placeholder="Rakesh Patel" />
            </Field>
            <Field label="Designation" error={errors.designation}>
              <Input value={values.designation} onChange={set("designation")} placeholder="Plant Head" />
            </Field>
            <Field label="Department" error={errors.department}>
              <Input value={values.department} onChange={set("department")} placeholder="Maintenance" />
            </Field>
            <Field label="Mobile" error={errors.mobile}>
              <Input value={values.mobile} onChange={set("mobile")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
            <Field label="WhatsApp number" error={errors.whatsapp} hint="used for report confirmation OTP">
              <Input value={values.whatsapp} onChange={set("whatsapp")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input value={values.email} onChange={set("email")} type="email" placeholder="contact@company.com" />
            </Field>
            <Field label="Alternate email" error={errors.altEmail}>
              <Input value={values.altEmail} onChange={set("altEmail")} type="email" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Billing address</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" error={errors.billingAddress} className="sm:col-span-2">
              <Textarea value={values.billingAddress} onChange={set("billingAddress")} rows={2} />
            </Field>
            <Field label="City" error={errors.city}>
              <Input value={values.city} onChange={set("city")} placeholder="Ahmedabad" />
            </Field>
            <Field label="State" error={errors.state}>
              <Input value={values.state} onChange={set("state")} placeholder="Gujarat" />
            </Field>
            <Field label="PIN code" error={errors.pinCode}>
              <Input value={values.pinCode} onChange={set("pinCode")} inputMode="numeric" maxLength={6} placeholder="382405" />
            </Field>
            <Field label="Status" error={errors.status}>
              <Select value={values.status} onChange={set("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
          </div>
        </div>

        <Field label="Remarks" error={errors.remarks}>
          <Textarea value={values.remarks} onChange={set("remarks")} rows={2} placeholder="Site access notes, AMC details, payment terms…" />
        </Field>
      </form>
    </Modal>
  );
}

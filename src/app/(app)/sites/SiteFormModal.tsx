"use client";

import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Textarea, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";

interface CustomerOption {
  id: string;
  code: string;
  companyName: string;
}

export interface SiteFormValues {
  id?: string;
  customerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  contactPerson: string;
  mobile: string;
  whatsapp: string;
  email: string;
  latitude: string;
  longitude: string;
  siteType: string;
  remarks: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY: SiteFormValues = {
  customerId: "", name: "", address: "", city: "", state: "Gujarat", pinCode: "",
  contactPerson: "", mobile: "", whatsapp: "", email: "", latitude: "", longitude: "",
  siteType: "", remarks: "", status: "ACTIVE",
};

export function SiteFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  initial?: Partial<SiteFormValues> & { id?: string };
}) {
  const toast = useToast();
  const [values, setValues] = useState<SiteFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initial } as SiteFormValues);
      setErrors({});
      setFormError(null);
      api
        .get<CustomerOption[]>("/api/customers/options")
        .then(setCustomers)
        .catch(() => undefined);
    }
  }, [open, initial]);

  const set = (k: keyof SiteFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.warning("Location not available", "Your browser does not support location services.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValues((v) => ({
          ...v,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast.success("Location captured");
        setLocating(false);
      },
      (err) => {
        const message = err.code === err.PERMISSION_DENIED
          ? "Location access was denied. You can enter latitude/longitude manually."
          : "Could not get your current location. Please try again or enter it manually.";
        toast.warning("Could not get location", message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = { ...values, latitude: values.latitude || null, longitude: values.longitude || null };
      const saved = initial?.id
        ? await api.put<{ id: string }>(`/api/sites/${initial.id}`, payload)
        : await api.post<{ id: string }>("/api/sites", payload);
      toast.success(initial?.id ? "Site updated" : "Site created", values.name);
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
      title={initial?.id ? "Edit Site" : "New Site"}
      description="A site can hold equipment and be the location for service jobs."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button form="site-form" type="submit" loading={busy}>
            {initial?.id ? "Save changes" : "Create site"}
          </Button>
        </>
      }
    >
      <form id="site-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <div>
          <SectionTitle>Site details</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" required error={errors.customerId}>
              <Select value={values.customerId} onChange={set("customerId")} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Site name" required error={errors.name}>
              <Input value={values.name} onChange={set("name")} required autoFocus placeholder="Unit 2 — Boiler House" />
            </Field>
            <Field label="Site type" error={errors.siteType}>
              <Input value={values.siteType} onChange={set("siteType")} placeholder="Factory / Warehouse / Office" />
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
          <SectionTitle>Site contact</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person" error={errors.contactPerson}>
              <Input value={values.contactPerson} onChange={set("contactPerson")} placeholder="Site in-charge name" />
            </Field>
            <Field label="Mobile" error={errors.mobile}>
              <Input value={values.mobile} onChange={set("mobile")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
            <Field label="WhatsApp number" error={errors.whatsapp}>
              <Input value={values.whatsapp} onChange={set("whatsapp")} type="tel" inputMode="tel" placeholder="98250 11111" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input value={values.email} onChange={set("email")} type="email" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Address</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" error={errors.address} className="sm:col-span-2">
              <Textarea value={values.address} onChange={set("address")} rows={2} />
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
          </div>
        </div>

        <div>
          <SectionTitle>Map location</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" error={errors.latitude}>
              <Input value={values.latitude} onChange={set("latitude")} inputMode="decimal" placeholder="23.022505" />
            </Field>
            <Field label="Longitude" error={errors.longitude}>
              <Input value={values.longitude} onChange={set("longitude")} inputMode="decimal" placeholder="72.571362" />
            </Field>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={useCurrentLocation} loading={locating}>
            <LocateFixed className="h-4 w-4" /> Use my current location
          </Button>
        </div>

        <Field label="Remarks" error={errors.remarks}>
          <Textarea value={values.remarks} onChange={set("remarks")} rows={2} placeholder="Access notes, security requirements…" />
        </Field>
      </form>
    </Modal>
  );
}

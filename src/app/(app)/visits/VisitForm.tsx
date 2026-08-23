"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, SectionTitle, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { formatDateInput } from "@/lib/format";

interface JobOption {
  id: string;
  jobNumber: string;
  customer: { companyName: string } | null;
  site: { name: string } | null;
  serviceType: { name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

export interface VisitFormValues {
  jobId: string;
  visitDate: string;
  arrivalTime: string;
  departureTime: string;
  engineerId: string;
  technicianNames: string;
  customerRepresentative: string;
  purpose: string;
  equipmentDetails: string;
  problemObserved: string;
  initialObservation: string;
  requiredAction: string;
  materialRequired: string;
  spareRequired: string;
  siteCondition: string;
  remarks: string;
}

const EMPTY: VisitFormValues = {
  jobId: "", visitDate: "", arrivalTime: "", departureTime: "", engineerId: "",
  technicianNames: "", customerRepresentative: "", purpose: "", equipmentDetails: "",
  problemObserved: "", initialObservation: "", requiredAction: "", materialRequired: "",
  spareRequired: "", siteCondition: "", remarks: "",
};

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function VisitForm({
  visitId,
  initial,
  lockedJobId,
}: {
  visitId?: string;
  initial?: Partial<VisitFormValues>;
  lockedJobId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<VisitFormValues>({
    ...EMPTY,
    visitDate: formatDateInput(new Date()),
    ...initial,
    ...(lockedJobId ? { jobId: lockedJobId } : {}),
  });
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .list<JobOption>(`/api/jobs${qs({ pageSize: 100 })}`)
      .then((r) => setJobs(r.items))
      .catch(() => setJobs([]));
    api
      .get<StaffOption[]>("/api/staff/options")
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const selectedJob = useMemo(() => jobs.find((j) => j.id === values.jobId), [jobs, values.jobId]);

  const set =
    (k: keyof VisitFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const saved = visitId
        ? await api.put<{ id: string }>(`/api/visits/${visitId}`, values)
        : await api.post<{ id: string }>("/api/visits", values);
      toast.success(visitId ? "Site visit updated" : "Site visit recorded");
      router.push(`/visits/${saved.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setFormError(err.fields ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Card title="Visit details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service job" required error={errors.jobId} className="sm:col-span-2">
            <Select value={values.jobId} onChange={set("jobId")} disabled={Boolean(lockedJobId)} required>
              <option value="">Select a job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.customer?.companyName ?? ""} · {j.site?.name ?? ""}
                </option>
              ))}
            </Select>
            {selectedJob?.serviceType && (
              <p className="mt-1 text-xs text-slate-500">Service type: {selectedJob.serviceType.name}</p>
            )}
          </Field>

          <Field label="Visit date" required error={errors.visitDate}>
            <Input type="date" value={values.visitDate} onChange={set("visitDate")} required />
          </Field>

          <Field label="Engineer" error={errors.engineerId}>
            <Select value={values.engineerId} onChange={set("engineerId")}>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Arrival time" error={errors.arrivalTime}>
            <div className="flex gap-2">
              <Input type="time" value={values.arrivalTime} onChange={set("arrivalTime")} />
              <Button
                type="button"
                variant="outline"
                onClick={() => setValues((v) => ({ ...v, arrivalTime: nowTime() }))}
                title="Stamp the current time"
              >
                <Clock className="h-4 w-4" /> Now
              </Button>
            </div>
          </Field>

          <Field label="Departure time" error={errors.departureTime}>
            <div className="flex gap-2">
              <Input type="time" value={values.departureTime} onChange={set("departureTime")} />
              <Button
                type="button"
                variant="outline"
                onClick={() => setValues((v) => ({ ...v, departureTime: nowTime() }))}
                title="Stamp the current time"
              >
                <Clock className="h-4 w-4" /> Now
              </Button>
            </div>
          </Field>

          <Field label="Technician(s)" error={errors.technicianNames}>
            <Input value={values.technicianNames} onChange={set("technicianNames")} placeholder="Names, comma separated" />
          </Field>

          <Field label="Customer representative" error={errors.customerRepresentative}>
            <Input value={values.customerRepresentative} onChange={set("customerRepresentative")} placeholder="Name and designation" />
          </Field>

          <Field label="Purpose of visit" error={errors.purpose} className="sm:col-span-2">
            <Textarea rows={2} value={values.purpose} onChange={set("purpose")} placeholder="Pre-maintenance inspection and scope finalisation" />
          </Field>

          <Field label="Equipment" error={errors.equipmentDetails} className="sm:col-span-2">
            <Textarea rows={2} value={values.equipmentDetails} onChange={set("equipmentDetails")} placeholder="2 TPH Steam Boiler, Sr. No. …" />
          </Field>
        </div>
      </Card>

      <Card title="Observations">
        <div className="space-y-4">
          <SectionTitle>What was found on site</SectionTitle>
          <Field label="Problem observed" error={errors.problemObserved}>
            <Textarea rows={3} value={values.problemObserved} onChange={set("problemObserved")} />
          </Field>
          <Field label="Initial observation" error={errors.initialObservation}>
            <Textarea rows={4} value={values.initialObservation} onChange={set("initialObservation")} />
          </Field>
          <Field label="Required action" error={errors.requiredAction}>
            <Textarea rows={3} value={values.requiredAction} onChange={set("requiredAction")} />
          </Field>

          <SectionTitle>Requirements</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Material required" error={errors.materialRequired}>
              <Textarea rows={2} value={values.materialRequired} onChange={set("materialRequired")} />
            </Field>
            <Field label="Spares required" error={errors.spareRequired}>
              <Textarea rows={2} value={values.spareRequired} onChange={set("spareRequired")} />
            </Field>
            <Field label="Site condition" error={errors.siteCondition}>
              <Textarea rows={2} value={values.siteCondition} onChange={set("siteCondition")} placeholder="Access, scaffolding, power, water availability" />
            </Field>
            <Field label="Remarks" error={errors.remarks}>
              <Textarea rows={2} value={values.remarks} onChange={set("remarks")} />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {visitId ? "Save changes" : "Save site visit"}
        </Button>
      </div>

      {!visitId && (
        <p className="text-right text-xs text-slate-500">
          Photographs can be added once the visit is saved.
        </p>
      )}
    </form>
  );
}

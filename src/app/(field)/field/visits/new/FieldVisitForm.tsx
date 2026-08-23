"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Check } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, Alert } from "@/components/ui/primitives";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateInput } from "@/lib/format";

export interface FieldJobOption {
  id: string;
  jobNumber: string;
  customerName: string;
  siteName: string;
  serviceTypeName: string;
  equipmentName: string | null;
}

const FIELD_CLASS = "h-12 text-base";

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function FieldVisitForm({
  jobs,
  defaultJobId,
  engineerId,
}: {
  jobs: FieldJobOption[];
  defaultJobId?: string;
  engineerId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({
    jobId: defaultJobId ?? jobs[0]?.id ?? "",
    visitDate: formatDateInput(new Date()),
    arrivalTime: "",
    departureTime: "",
    engineerId,
    technicianNames: "",
    customerRepresentative: "",
    purpose: "",
    equipmentDetails: "",
    problemObserved: "",
    initialObservation: "",
    requiredAction: "",
    materialRequired: "",
    spareRequired: "",
    siteCondition: "",
    remarks: "",
  });
  const [saved, setSaved] = useState<{ id: string; visitNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const job = jobs.find((j) => j.id === values.jobId);

  useEffect(() => {
    if (job && !values.equipmentDetails && job.equipmentName) {
      setValues((v) => ({ ...v, equipmentDetails: job.equipmentName ?? "" }));
    }
  }, [job, values.equipmentDetails]);

  const set =
    (k: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string; visitNumber: string }>("/api/visits", values);
      setSaved(res);
      toast.success("Visit saved", `${res.visitNumber} — you can now add photographs.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this visit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="space-y-4">
        <Card bodyClassName="p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-700" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{saved.visitNumber} saved</p>
              <p className="text-xs text-slate-500">Add site photographs now, while you are still on site.</p>
            </div>
          </div>
          <PhotoUploader
            link={{ siteVisitId: saved.id, jobId: values.jobId }}
            defaultCategory="EQUIPMENT"
            compact
          />
        </Card>

        <div className="grid gap-2">
          <Button size="lg" onClick={() => router.push(`/visits/${saved.id}`)}>
            Open the visit
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push(`/mom/new?jobId=${values.jobId}&siteVisitId=${saved.id}`)}>
            Create MOM from this visit
          </Button>
          <Button size="lg" variant="ghost" onClick={() => router.push("/field/visits")}>
            Back to my visits
          </Button>
        </div>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <Alert tone="info" title="No jobs assigned to you">
        A site visit must belong to a service job. Ask the office to assign you a job first.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card bodyClassName="p-4">
        <div className="space-y-3.5">
          <Field label="Job" required>
            <Select value={values.jobId} onChange={set("jobId")} required className={FIELD_CLASS}>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.customerName}
                </option>
              ))}
            </Select>
            {job && <p className="mt-1 text-xs text-slate-500">{job.siteName} · {job.serviceTypeName}</p>}
          </Field>

          <Field label="Visit date" required>
            <Input type="date" value={values.visitDate} onChange={set("visitDate")} required className={FIELD_CLASS} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Arrival">
              <div className="flex gap-1.5">
                <Input type="time" value={values.arrivalTime} onChange={set("arrivalTime")} className={FIELD_CLASS} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValues((v) => ({ ...v, arrivalTime: nowTime() }))}
                  aria-label="Stamp arrival time"
                  className="h-12 w-12 shrink-0 p-0"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Field label="Departure">
              <div className="flex gap-1.5">
                <Input type="time" value={values.departureTime} onChange={set("departureTime")} className={FIELD_CLASS} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValues((v) => ({ ...v, departureTime: nowTime() }))}
                  aria-label="Stamp departure time"
                  className="h-12 w-12 shrink-0 p-0"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Customer representative">
            <Input
              value={values.customerRepresentative}
              onChange={set("customerRepresentative")}
              placeholder="Who met you on site"
              className={FIELD_CLASS}
            />
          </Field>

          <Field label="Technician(s) with you">
            <Input value={values.technicianNames} onChange={set("technicianNames")} className={FIELD_CLASS} />
          </Field>
        </div>
      </Card>

      <Card title="What did you find?" bodyClassName="p-4">
        <div className="space-y-3.5">
          <Field label="Purpose of visit">
            <Textarea rows={2} value={values.purpose} onChange={set("purpose")} className="text-base" />
          </Field>
          <Field label="Equipment">
            <Input value={values.equipmentDetails} onChange={set("equipmentDetails")} className={FIELD_CLASS} />
          </Field>
          <Field label="Problem observed">
            <Textarea rows={3} value={values.problemObserved} onChange={set("problemObserved")} className="text-base" />
          </Field>
          <Field label="Initial observation">
            <Textarea rows={4} value={values.initialObservation} onChange={set("initialObservation")} className="text-base" />
          </Field>
          <Field label="Action required">
            <Textarea rows={3} value={values.requiredAction} onChange={set("requiredAction")} className="text-base" />
          </Field>
          <Field label="Material required">
            <Textarea rows={2} value={values.materialRequired} onChange={set("materialRequired")} className="text-base" />
          </Field>
          <Field label="Spares required">
            <Textarea rows={2} value={values.spareRequired} onChange={set("spareRequired")} className="text-base" />
          </Field>
          <Field label="Site condition">
            <Textarea rows={2} value={values.siteCondition} onChange={set("siteCondition")} className="text-base" />
          </Field>
          <Field label="Remarks">
            <Textarea rows={2} value={values.remarks} onChange={set("remarks")} className="text-base" />
          </Field>
        </div>
      </Card>

      <Button type="submit" size="lg" loading={busy} className="w-full">
        Save visit
      </Button>
      <p className="text-center text-xs text-slate-500">Photographs can be added on the next screen.</p>
    </form>
  );
}

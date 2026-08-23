"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Field, Input, Select, Textarea, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { formatDateInput } from "@/lib/format";

interface JobOption {
  id: string;
  jobNumber: string;
  customer: { companyName: string };
  site: { name: string };
}

interface FinalReportFormValues {
  jobId: string;
  workStartDate: string;
  workEndDate: string;
  engineerName: string;
  technicianNames: string;
  workPerformed: string;
  materialsSummary: string;
  sparesSummary: string;
  testingDetails: string;
  observations: string;
  pendingWork: string;
  recommendations: string;
  finalRemarks: string;
  completionDate: string;
}

const EMPTY: FinalReportFormValues = {
  jobId: "", workStartDate: "", workEndDate: "", engineerName: "", technicianNames: "",
  workPerformed: "", materialsSummary: "", sparesSummary: "", testingDetails: "", observations: "",
  pendingWork: "", recommendations: "", finalRemarks: "", completionDate: "",
};

export interface FinalReportRecord {
  id: string;
  reportNumber: string;
  status: string;
  version: number;
  jobId: string;
  workStartDate: string | Date | null;
  workEndDate: string | Date | null;
  engineerName: string | null;
  technicianNames: string | null;
  workPerformed: string | null;
  materialsSummary: string | null;
  sparesSummary: string | null;
  testingDetails: string | null;
  observations: string | null;
  pendingWork: string | null;
  recommendations: string | null;
  finalRemarks: string | null;
  completionDate: string | Date | null;
}

function fromRecord(record?: FinalReportRecord, initialJobId?: string): FinalReportFormValues {
  if (!record) return { ...EMPTY, jobId: initialJobId ?? "" };
  return {
    jobId: record.jobId,
    workStartDate: formatDateInput(record.workStartDate),
    workEndDate: formatDateInput(record.workEndDate),
    engineerName: record.engineerName ?? "",
    technicianNames: record.technicianNames ?? "",
    workPerformed: record.workPerformed ?? "",
    materialsSummary: record.materialsSummary ?? "",
    sparesSummary: record.sparesSummary ?? "",
    testingDetails: record.testingDetails ?? "",
    observations: record.observations ?? "",
    pendingWork: record.pendingWork ?? "",
    recommendations: record.recommendations ?? "",
    finalRemarks: record.finalRemarks ?? "",
    completionDate: formatDateInput(record.completionDate),
  };
}

export function FinalReportForm({
  reportId,
  initialJobId,
  initial,
}: {
  reportId?: string;
  initialJobId?: string;
  initial?: FinalReportRecord;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<FinalReportFormValues>(() => fromRecord(initial, initialJobId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);

  useEffect(() => {
    api.list<JobOption>(`/api/jobs${qs({ pageSize: 100 })}`).then((r) => setJobs(r.items)).catch(() => undefined);
  }, []);

  const set = (k: keyof FinalReportFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (mode: "draft" | "submit") => {
    setBusy(mode);
    setErrors({});
    setFormError(null);
    try {
      const payload = { ...values };

      const saved = reportId
        ? await api.put<{ id: string }>(`/api/final-reports/${reportId}`, payload)
        : await api.post<{ id: string }>("/api/final-reports", payload);

      if (mode === "submit") {
        await api.post(`/api/final-reports/${saved.id}/submit`);
      }

      toast.success(mode === "submit" ? "Report submitted" : "Draft saved");
      router.push(`/final-reports/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setFormError(err.fields ? null : err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setBusy(null);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Card title="Job & dates">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job" required error={errors.jobId} className="sm:col-span-2">
            <Select value={values.jobId} onChange={set("jobId")} required autoFocus disabled={Boolean(reportId)}>
              <option value="">Select job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.customer.companyName} · {j.site.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Work start date" error={errors.workStartDate}>
            <Input type="date" value={values.workStartDate} onChange={set("workStartDate")} />
          </Field>
          <Field label="Work end date" error={errors.workEndDate}>
            <Input type="date" value={values.workEndDate} onChange={set("workEndDate")} />
          </Field>
          <Field label="Completion date" error={errors.completionDate}>
            <Input type="date" value={values.completionDate} onChange={set("completionDate")} />
          </Field>
          <Field label="Engineer name(s)" error={errors.engineerName}>
            <Input value={values.engineerName} onChange={set("engineerName")} placeholder="Names, comma separated" />
          </Field>
          <Field label="Technician(s)" error={errors.technicianNames} className="sm:col-span-2">
            <Input value={values.technicianNames} onChange={set("technicianNames")} placeholder="Names, comma separated" />
          </Field>
        </div>
      </Card>

      <Card title="Work performed">
        <div className="grid gap-4">
          <Field label="Scope of work executed" error={errors.workPerformed}>
            <Textarea value={values.workPerformed} onChange={set("workPerformed")} rows={6} placeholder="Summarise all the work carried out across the job…" />
          </Field>
          <Field label="Testing & commissioning" error={errors.testingDetails}>
            <Textarea value={values.testingDetails} onChange={set("testingDetails")} rows={3} />
          </Field>
          <Field label="Observations" error={errors.observations}>
            <Textarea value={values.observations} onChange={set("observations")} rows={3} />
          </Field>
        </div>
      </Card>

      <Card title="Materials & spares">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Materials consumed" error={errors.materialsSummary}>
            <Textarea value={values.materialsSummary} onChange={set("materialsSummary")} rows={4} />
          </Field>
          <Field label="Spares replaced" error={errors.sparesSummary}>
            <Textarea value={values.sparesSummary} onChange={set("sparesSummary")} rows={4} />
          </Field>
        </div>
      </Card>

      <Card title="Closure">
        <div className="grid gap-4">
          <Field label="Pending work" error={errors.pendingWork}>
            <Textarea value={values.pendingWork} onChange={set("pendingWork")} rows={2} />
          </Field>
          <Field label="Recommendations" error={errors.recommendations}>
            <Textarea value={values.recommendations} onChange={set("recommendations")} rows={2} />
          </Field>
          <Field label="Final remarks" error={errors.finalRemarks}>
            <Textarea value={values.finalRemarks} onChange={set("finalRemarks")} rows={2} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy !== null}>Cancel</Button>
        <Button type="button" variant="secondary" onClick={() => submit("draft")} loading={busy === "draft"} disabled={busy !== null && busy !== "draft"}>
          Save as draft
        </Button>
        <Button type="button" onClick={() => submit("submit")} loading={busy === "submit"} disabled={busy !== null && busy !== "submit"}>
          Save & submit
        </Button>
      </div>
    </form>
  );
}

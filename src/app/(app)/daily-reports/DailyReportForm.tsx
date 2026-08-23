"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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

interface StaffOption {
  id: string;
  name: string;
}

interface MaterialRowValue {
  id: string;
  name: string;
  specification: string;
  quantity: string;
  unit: string;
  remarks: string;
}

interface SpareRowValue {
  id: string;
  name: string;
  partNumber: string;
  make: string;
  quantity: string;
  unit: string;
  remarks: string;
}

interface DailyReportFormValues {
  jobId: string;
  reportDate: string;
  engineerId: string;
  technicianNames: string;
  startTime: string;
  endTime: string;
  workHours: string;
  progressPercent: number;
  workPerformed: string;
  toolsUsed: string;
  technicalFindings: string;
  problems: string;
  pendingWork: string;
  nextAction: string;
  recommendations: string;
  remarks: string;
  materials: MaterialRowValue[];
  spares: SpareRowValue[];
}

const EMPTY: DailyReportFormValues = {
  jobId: "", reportDate: "", engineerId: "", technicianNames: "", startTime: "", endTime: "",
  workHours: "", progressPercent: 0, workPerformed: "", toolsUsed: "", technicalFindings: "",
  problems: "", pendingWork: "", nextAction: "", recommendations: "", remarks: "",
  materials: [], spares: [],
};

let rowSeq = 0;
const newRowId = () => `row-${++rowSeq}-${Date.now()}`;

function emptyMaterial(): MaterialRowValue {
  return { id: newRowId(), name: "", specification: "", quantity: "1", unit: "", remarks: "" };
}
function emptySpare(): SpareRowValue {
  return { id: newRowId(), name: "", partNumber: "", make: "", quantity: "1", unit: "", remarks: "" };
}

/** "HH:MM" start/end → hours worked, rounded to two decimals; handles an overnight shift. */
function hoursBetween(start: string, end: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return String(Math.round((minutes / 60) * 100) / 100);
}

export interface DailyReportRecord {
  id: string;
  reportNumber: string;
  status: string;
  version: number;
  jobId: string;
  reportDate: string | Date;
  engineerId: string | null;
  technicianNames: string | null;
  startTime: string | null;
  endTime: string | null;
  workHours: number | null;
  progressPercent: number;
  workPerformed: string | null;
  toolsUsed: string | null;
  technicalFindings: string | null;
  problems: string | null;
  pendingWork: string | null;
  nextAction: string | null;
  recommendations: string | null;
  remarks: string | null;
  materials: { name: string; specification: string | null; quantity: number; unit: string | null; remarks: string | null }[];
  spares: { name: string; partNumber: string | null; make: string | null; quantity: number; unit: string | null; remarks: string | null }[];
}

function fromRecord(record?: DailyReportRecord, initialJobId?: string): DailyReportFormValues {
  if (!record) return { ...EMPTY, jobId: initialJobId ?? "" };
  return {
    jobId: record.jobId,
    reportDate: formatDateInput(record.reportDate),
    engineerId: record.engineerId ?? "",
    technicianNames: record.technicianNames ?? "",
    startTime: record.startTime ?? "",
    endTime: record.endTime ?? "",
    workHours: record.workHours != null ? String(record.workHours) : "",
    progressPercent: record.progressPercent ?? 0,
    workPerformed: record.workPerformed ?? "",
    toolsUsed: record.toolsUsed ?? "",
    technicalFindings: record.technicalFindings ?? "",
    problems: record.problems ?? "",
    pendingWork: record.pendingWork ?? "",
    nextAction: record.nextAction ?? "",
    recommendations: record.recommendations ?? "",
    remarks: record.remarks ?? "",
    materials: record.materials.map((m) => ({
      id: newRowId(), name: m.name, specification: m.specification ?? "", quantity: String(m.quantity), unit: m.unit ?? "", remarks: m.remarks ?? "",
    })),
    spares: record.spares.map((s) => ({
      id: newRowId(), name: s.name, partNumber: s.partNumber ?? "", make: s.make ?? "", quantity: String(s.quantity), unit: s.unit ?? "", remarks: s.remarks ?? "",
    })),
  };
}

export function DailyReportForm({
  reportId,
  initialJobId,
  initial,
}: {
  reportId?: string;
  initialJobId?: string;
  initial?: DailyReportRecord;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<DailyReportFormValues>(() => fromRecord(initial, initialJobId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [hoursTouched, setHoursTouched] = useState(Boolean(initial?.workHours));

  useEffect(() => {
    api.list<JobOption>(`/api/jobs${qs({ pageSize: 100 })}`).then((r) => setJobs(r.items)).catch(() => undefined);
    api.get<StaffOption[]>("/api/staff/options").then(setStaff).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (hoursTouched) return;
    const computed = hoursBetween(values.startTime, values.endTime);
    if (computed) setValues((v) => ({ ...v, workHours: computed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startTime, values.endTime]);

  const set = (k: keyof DailyReportFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const setMaterial = (id: string, key: keyof MaterialRowValue, value: string) =>
    setValues((v) => ({ ...v, materials: v.materials.map((m) => (m.id === id ? { ...m, [key]: value } : m)) }));
  const setSpare = (id: string, key: keyof SpareRowValue, value: string) =>
    setValues((v) => ({ ...v, spares: v.spares.map((s) => (s.id === id ? { ...s, [key]: value } : s)) }));

  const submit = async (mode: "draft" | "submit") => {
    setBusy(mode);
    setErrors({});
    setFormError(null);
    try {
      const payload = {
        jobId: values.jobId,
        reportDate: values.reportDate,
        engineerId: values.engineerId,
        technicianNames: values.technicianNames,
        startTime: values.startTime,
        endTime: values.endTime,
        workHours: values.workHours === "" ? undefined : Number(values.workHours),
        progressPercent: values.progressPercent,
        workPerformed: values.workPerformed,
        toolsUsed: values.toolsUsed,
        technicalFindings: values.technicalFindings,
        problems: values.problems,
        pendingWork: values.pendingWork,
        nextAction: values.nextAction,
        recommendations: values.recommendations,
        remarks: values.remarks,
        materials: values.materials
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name, specification: m.specification, quantity: Number(m.quantity) || 0, unit: m.unit, remarks: m.remarks })),
        spares: values.spares
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name, partNumber: s.partNumber, make: s.make, quantity: Number(s.quantity) || 0, unit: s.unit, remarks: s.remarks })),
      };

      const saved = reportId
        ? await api.put<{ id: string }>(`/api/daily-reports/${reportId}`, payload)
        : await api.post<{ id: string }>("/api/daily-reports", payload);

      if (mode === "submit") {
        await api.post(`/api/daily-reports/${saved.id}/submit`);
      }

      toast.success(mode === "submit" ? "Report submitted" : "Draft saved");
      router.push(`/daily-reports/${saved.id}`);
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

      <Card title="Job & date">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job" required error={errors.jobId} className="sm:col-span-2">
            <Select value={values.jobId} onChange={set("jobId")} required autoFocus>
              <option value="">Select job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.customer.companyName} · {j.site.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Report date" required error={errors.reportDate}>
            <Input type="date" value={values.reportDate} onChange={set("reportDate")} required />
          </Field>
          <Field label="Engineer" error={errors.engineerId}>
            <Select value={values.engineerId} onChange={set("engineerId")}>
              <option value="">Select engineer</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Technician(s)" error={errors.technicianNames} className="sm:col-span-2">
            <Input value={values.technicianNames} onChange={set("technicianNames")} placeholder="Names, comma separated" />
          </Field>
        </div>
      </Card>

      <Card title="Time & progress">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Start time" error={errors.startTime}>
            <Input type="time" value={values.startTime} onChange={set("startTime")} />
          </Field>
          <Field label="End time" error={errors.endTime}>
            <Input type="time" value={values.endTime} onChange={set("endTime")} />
          </Field>
          <Field label="Work hours" error={errors.workHours} hint="auto-calculated, editable">
            <Input
              type="number"
              min={0}
              max={24}
              step={0.25}
              value={values.workHours}
              onChange={(e) => { setHoursTouched(true); setValues((v) => ({ ...v, workHours: e.target.value })); }}
            />
          </Field>
          <Field label="Progress" error={errors.progressPercent}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={values.progressPercent}
                onChange={(e) => setValues((v) => ({ ...v, progressPercent: Number(e.target.value) }))}
                className="te-focus h-2 w-full accent-[var(--te-primary)]"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={values.progressPercent}
                onChange={(e) => setValues((v) => ({ ...v, progressPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                className="w-16 shrink-0"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Work carried out">
        <div className="grid gap-4">
          <Field label="Work performed" error={errors.workPerformed}>
            <Textarea value={values.workPerformed} onChange={set("workPerformed")} rows={4} placeholder="Describe the work done today…" />
          </Field>
          <Field label="Tools used" error={errors.toolsUsed}>
            <Textarea value={values.toolsUsed} onChange={set("toolsUsed")} rows={2} />
          </Field>
          <Field label="Technical findings" error={errors.technicalFindings}>
            <Textarea value={values.technicalFindings} onChange={set("technicalFindings")} rows={3} />
          </Field>
          <Field label="Problems encountered" error={errors.problems}>
            <Textarea value={values.problems} onChange={set("problems")} rows={2} />
          </Field>
        </div>
      </Card>

      <Card
        title="Materials used"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setValues((v) => ({ ...v, materials: [...v.materials, emptyMaterial()] }))}>
            <Plus className="h-3.5 w-3.5" /> Add material
          </Button>
        }
      >
        {values.materials.length === 0 ? (
          <p className="text-sm text-slate-500">No materials recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {values.materials.map((m) => (
              <div key={m.id} className="grid items-center gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
                <Input className="sm:col-span-3" placeholder="Material name" value={m.name} onChange={(e) => setMaterial(m.id, "name", e.target.value)} />
                <Input className="sm:col-span-3" placeholder="Specification" value={m.specification} onChange={(e) => setMaterial(m.id, "specification", e.target.value)} />
                <Input className="sm:col-span-2" type="number" min={0} placeholder="Qty" value={m.quantity} onChange={(e) => setMaterial(m.id, "quantity", e.target.value)} />
                <Input className="sm:col-span-1" placeholder="Unit" value={m.unit} onChange={(e) => setMaterial(m.id, "unit", e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Remarks" value={m.remarks} onChange={(e) => setMaterial(m.id, "remarks", e.target.value)} />
                <Button
                  type="button" variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 sm:col-span-1"
                  onClick={() => setValues((v) => ({ ...v, materials: v.materials.filter((x) => x.id !== m.id) }))}
                  aria-label="Remove material"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Spares used"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setValues((v) => ({ ...v, spares: [...v.spares, emptySpare()] }))}>
            <Plus className="h-3.5 w-3.5" /> Add spare
          </Button>
        }
      >
        {values.spares.length === 0 ? (
          <p className="text-sm text-slate-500">No spares recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {values.spares.map((s) => (
              <div key={s.id} className="grid items-center gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
                <Input className="sm:col-span-3" placeholder="Spare name" value={s.name} onChange={(e) => setSpare(s.id, "name", e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Part no." value={s.partNumber} onChange={(e) => setSpare(s.id, "partNumber", e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Make" value={s.make} onChange={(e) => setSpare(s.id, "make", e.target.value)} />
                <Input className="sm:col-span-1" type="number" min={0} placeholder="Qty" value={s.quantity} onChange={(e) => setSpare(s.id, "quantity", e.target.value)} />
                <Input className="sm:col-span-1" placeholder="Unit" value={s.unit} onChange={(e) => setSpare(s.id, "unit", e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Remarks" value={s.remarks} onChange={(e) => setSpare(s.id, "remarks", e.target.value)} />
                <Button
                  type="button" variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 sm:col-span-1"
                  onClick={() => setValues((v) => ({ ...v, spares: v.spares.filter((x) => x.id !== s.id) }))}
                  aria-label="Remove spare"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Status & next steps">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pending work" error={errors.pendingWork}>
            <Textarea value={values.pendingWork} onChange={set("pendingWork")} rows={2} />
          </Field>
          <Field label="Next action" error={errors.nextAction}>
            <Textarea value={values.nextAction} onChange={set("nextAction")} rows={2} />
          </Field>
          <Field label="Recommendations" error={errors.recommendations}>
            <Textarea value={values.recommendations} onChange={set("recommendations")} rows={2} />
          </Field>
          <Field label="Remarks" error={errors.remarks}>
            <Textarea value={values.remarks} onChange={set("remarks")} rows={2} />
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

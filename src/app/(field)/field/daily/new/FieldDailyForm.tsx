"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Check, Plus, X } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, Alert } from "@/components/ui/primitives";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateInput } from "@/lib/format";
import type { FieldJobOption } from "../../visits/new/FieldVisitForm";

const FIELD_CLASS = "h-12 text-base";

interface Line {
  key: string;
  name: string;
  specification: string;
  partNumber: string;
  make: string;
  quantity: string;
  unit: string;
}

const emptyLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  specification: "",
  partNumber: "",
  make: "",
  quantity: "1",
  unit: "",
});

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Hours between two HH:MM strings, rounded to a quarter hour. */
function hoursBetween(start: string, end: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return "";
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return (Math.round((mins / 60) * 4) / 4).toFixed(2);
}

export function FieldDailyForm({
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
    reportDate: formatDateInput(new Date()),
    engineerId,
    technicianNames: "",
    startTime: "",
    endTime: "",
    workHours: "",
    progressPercent: "0",
    workPerformed: "",
    toolsUsed: "",
    technicalFindings: "",
    problems: "",
    pendingWork: "",
    nextAction: "",
    recommendations: "",
    remarks: "",
  });
  const [materials, setMaterials] = useState<Line[]>([]);
  const [spares, setSpares] = useState<Line[]>([]);
  const [saved, setSaved] = useState<{ id: string; reportNumber: string } | null>(null);
  const [photoCategory, setPhotoCategory] = useState("DURING_WORK");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const job = jobs.find((j) => j.id === values.jobId);
  const autoHours = useMemo(() => hoursBetween(values.startTime, values.endTime), [values.startTime, values.endTime]);
  const effectiveHours = values.workHours || autoHours;

  const set =
    (k: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (submitNow: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...values,
        workHours: effectiveHours ? Number(effectiveHours) : null,
        progressPercent: Number(values.progressPercent),
        materials: materials
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name, specification: m.specification, quantity: Number(m.quantity) || 0, unit: m.unit })),
        spares: spares
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name, partNumber: s.partNumber, make: s.make, quantity: Number(s.quantity) || 0, unit: s.unit })),
      };
      const res = await api.post<{ id: string; reportNumber: string }>("/api/daily-reports", payload);
      if (submitNow) {
        await api.post(`/api/daily-reports/${res.id}/submit`).catch(() => undefined);
      }
      setSaved(res);
      toast.success(submitNow ? "Report submitted" : "Report saved", `${res.reportNumber} — add photographs next.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this report. Please try again.");
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
              <p className="text-sm font-bold text-slate-900">{saved.reportNumber} saved</p>
              <p className="text-xs text-slate-500">Add before, during and after photographs.</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {(
              [
                ["BEFORE_WORK", "Before"],
                ["DURING_WORK", "During"],
                ["AFTER_WORK", "After"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPhotoCategory(key)}
                className={`te-focus h-10 rounded-md border text-sm font-medium ${
                  photoCategory === key
                    ? "border-[var(--te-primary)] bg-[var(--te-primary-light)] text-[var(--te-primary)]"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <PhotoUploader
            key={photoCategory}
            link={{ dailyReportId: saved.id, jobId: values.jobId }}
            defaultCategory={photoCategory}
            compact
          />
        </Card>

        <div className="grid gap-2">
          <Button size="lg" onClick={() => router.push(`/daily-reports/${saved.id}`)}>
            Open the report
          </Button>
          <Button size="lg" variant="ghost" onClick={() => router.push("/field/daily")}>
            Back to daily work
          </Button>
        </div>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <Alert tone="info" title="No jobs assigned to you">
        A daily work report must belong to a service job. Ask the office to assign you a job first.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
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

          <Field label="Date" required>
            <Input type="date" value={values.reportDate} onChange={set("reportDate")} required className={FIELD_CLASS} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <div className="flex gap-1.5">
                <Input type="time" value={values.startTime} onChange={set("startTime")} className={FIELD_CLASS} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValues((v) => ({ ...v, startTime: nowTime() }))}
                  aria-label="Stamp start time"
                  className="h-12 w-12 shrink-0 p-0"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Field label="End">
              <div className="flex gap-1.5">
                <Input type="time" value={values.endTime} onChange={set("endTime")} className={FIELD_CLASS} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValues((v) => ({ ...v, endTime: nowTime() }))}
                  aria-label="Stamp end time"
                  className="h-12 w-12 shrink-0 p-0"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Work hours" hint={autoHours ? `calculated: ${autoHours}` : undefined}>
            <Input
              type="number"
              step="0.25"
              min={0}
              max={24}
              inputMode="decimal"
              value={effectiveHours}
              onChange={set("workHours")}
              className={FIELD_CLASS}
            />
          </Field>

          <Field label={`Progress — ${values.progressPercent}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values.progressPercent}
              onChange={set("progressPercent")}
              aria-label="Progress percentage"
              className="h-8 w-full accent-[var(--te-accent)]"
            />
          </Field>

          <Field label="Technician(s) with you">
            <Input value={values.technicianNames} onChange={set("technicianNames")} className={FIELD_CLASS} />
          </Field>
        </div>
      </Card>

      <Card title="Work carried out" bodyClassName="p-4">
        <div className="space-y-3.5">
          <Field label="Work performed" required>
            <Textarea rows={5} value={values.workPerformed} onChange={set("workPerformed")} className="text-base" />
          </Field>
          <Field label="Technical findings">
            <Textarea rows={3} value={values.technicalFindings} onChange={set("technicalFindings")} className="text-base" />
          </Field>
          <Field label="Problems encountered">
            <Textarea rows={2} value={values.problems} onChange={set("problems")} className="text-base" />
          </Field>
          <Field label="Tools used">
            <Input value={values.toolsUsed} onChange={set("toolsUsed")} className={FIELD_CLASS} />
          </Field>
        </div>
      </Card>

      <LineEditor title="Materials used" lines={materials} setLines={setMaterials} kind="material" />
      <LineEditor title="Spares used" lines={spares} setLines={setSpares} kind="spare" />

      <Card title="Next steps" bodyClassName="p-4">
        <div className="space-y-3.5">
          <Field label="Pending work">
            <Textarea rows={2} value={values.pendingWork} onChange={set("pendingWork")} className="text-base" />
          </Field>
          <Field label="Next action">
            <Textarea rows={2} value={values.nextAction} onChange={set("nextAction")} className="text-base" />
          </Field>
          <Field label="Recommendations">
            <Textarea rows={2} value={values.recommendations} onChange={set("recommendations")} className="text-base" />
          </Field>
          <Field label="Remarks">
            <Textarea rows={2} value={values.remarks} onChange={set("remarks")} className="text-base" />
          </Field>
        </div>
      </Card>

      <div className="grid gap-2">
        <Button size="lg" onClick={() => submit(true)} loading={busy}>
          Save &amp; submit
        </Button>
        <Button size="lg" variant="outline" onClick={() => submit(false)} disabled={busy}>
          Save as draft
        </Button>
      </div>
      <p className="text-center text-xs text-slate-500">Photographs can be added on the next screen.</p>
    </div>
  );
}

function LineEditor({
  title,
  lines,
  setLines,
  kind,
}: {
  title: string;
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
  kind: "material" | "spare";
}) {
  const update = (key: string, patch: Partial<Line>) =>
    setLines((l) => l.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <Card
      title={title}
      actions={
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((l) => [...l, emptyLine()])}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
      bodyClassName="p-4"
    >
      {lines.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing recorded.</p>
      ) : (
        <ul className="space-y-3">
          {lines.map((row) => (
            <li key={row.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-start gap-2">
                <Input
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder={kind === "material" ? "Material name" : "Spare name"}
                  className="h-11 text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLines((l) => l.filter((x) => x.key !== row.key))}
                  aria-label="Remove"
                  className="h-11 w-11 shrink-0 p-0 text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={kind === "material" ? row.specification : row.partNumber}
                  onChange={(e) =>
                    update(row.key, kind === "material" ? { specification: e.target.value } : { partNumber: e.target.value })
                  }
                  placeholder={kind === "material" ? "Specification" : "Part number"}
                  className="h-11"
                />
                {kind === "spare" && (
                  <Input value={row.make} onChange={(e) => update(row.key, { make: e.target.value })} placeholder="Make" className="h-11" />
                )}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={row.quantity}
                  onChange={(e) => update(row.key, { quantity: e.target.value })}
                  placeholder="Qty"
                  className="h-11"
                />
                <Input value={row.unit} onChange={(e) => update(row.key, { unit: e.target.value })} placeholder="Unit" className="h-11" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

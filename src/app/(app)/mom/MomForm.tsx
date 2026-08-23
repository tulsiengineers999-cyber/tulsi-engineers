"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Card, Button, Field, Input, Select, Textarea, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, qs, ApiError } from "@/lib/client-api";
import { formatDateInput } from "@/lib/format";
import { PRIORITY_LABELS, RESPONSIBLE_PARTY_LABELS, ACTION_POINT_STATUS_LABELS } from "@/lib/masters";

type Party = "TULSI_ENGINEERS" | "CUSTOMER" | "THIRD_PARTY";
type PriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type ActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "CANCELLED";

interface ParticipantRow {
  name: string;
  designation: string;
  company: string;
  party: Party;
  mobile: string;
  email: string;
}

interface ActionPointRow {
  id?: string;
  actionPoint: string;
  responsiblePerson: string;
  responsibleParty: Party;
  responsibleCompany: string;
  dueDate: string;
  priority: PriorityValue;
  status: ActionStatus;
  remarks: string;
}

interface JobSummary {
  id: string;
  jobNumber: string;
  customer: { id: string; companyName: string };
  site: { id: string; name: string };
}

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
interface JobOption {
  id: string;
  jobNumber: string;
  status: string;
}
interface SiteVisitOption {
  id: string;
  visitNumber: string;
  visitDate: string;
}
interface StaffOption {
  id: string;
  name: string;
  designation?: string | null;
  mobile?: string | null;
  email?: string | null;
}

interface MomFormValues {
  meetingDate: string;
  meetingTime: string;
  location: string;
  equipmentDetails: string;
  purpose: string;
  discussionPoints: string;
  technicalObservations: string;
  problemsIdentified: string;
  decisionsTaken: string;
  requiredMaterials: string;
  requiredSpares: string;
  pendingPoints: string;
  recommendations: string;
  clientRemarks: string;
}

const EMPTY_PARTICIPANT: ParticipantRow = { name: "", designation: "", company: "", party: "TULSI_ENGINEERS", mobile: "", email: "" };
const EMPTY_ACTION_POINT: ActionPointRow = {
  actionPoint: "", responsiblePerson: "", responsibleParty: "TULSI_ENGINEERS", responsibleCompany: "",
  dueDate: "", priority: "MEDIUM", status: "OPEN", remarks: "",
};

export interface MomFormInitial {
  id?: string;
  status?: string;
  jobId: string;
  siteVisitId?: string | null;
  job?: { id: string; jobNumber: string } | null;
  customer?: { id: string; companyName: string } | null;
  site?: { id: string; name: string } | null;
  meetingDate?: string;
  meetingTime?: string | null;
  location?: string | null;
  equipmentDetails?: string | null;
  purpose?: string | null;
  discussionPoints?: string | null;
  technicalObservations?: string | null;
  problemsIdentified?: string | null;
  decisionsTaken?: string | null;
  requiredMaterials?: string | null;
  requiredSpares?: string | null;
  pendingPoints?: string | null;
  recommendations?: string | null;
  clientRemarks?: string | null;
  participants?: Partial<ParticipantRow>[];
  actionPoints?: (Partial<ActionPointRow> & { id?: string; dueDate?: string | null })[];
}

export function MomForm({ initial, momId }: { initial?: MomFormInitial; momId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const initialJobId = initial?.jobId || searchParams.get("jobId") || "";
  const [jobId, setJobId] = useState(initialJobId);
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(
    initial?.job && initial?.customer && initial?.site
      ? { id: initial.job.id, jobNumber: initial.job.jobNumber, customer: initial.customer, site: initial.site }
      : null,
  );
  const [jobLoading, setJobLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);

  const [siteVisitId, setSiteVisitId] = useState(initial?.siteVisitId ?? searchParams.get("siteVisitId") ?? "");
  const [siteVisits, setSiteVisits] = useState<SiteVisitOption[]>([]);

  const [values, setValues] = useState<MomFormValues>({
    meetingDate: formatDateInput(initial?.meetingDate) || formatDateInput(new Date()),
    meetingTime: initial?.meetingTime ?? "",
    location: initial?.location ?? "",
    equipmentDetails: initial?.equipmentDetails ?? "",
    purpose: initial?.purpose ?? "",
    discussionPoints: initial?.discussionPoints ?? "",
    technicalObservations: initial?.technicalObservations ?? "",
    problemsIdentified: initial?.problemsIdentified ?? "",
    decisionsTaken: initial?.decisionsTaken ?? "",
    requiredMaterials: initial?.requiredMaterials ?? "",
    requiredSpares: initial?.requiredSpares ?? "",
    pendingPoints: initial?.pendingPoints ?? "",
    recommendations: initial?.recommendations ?? "",
    clientRemarks: initial?.clientRemarks ?? "",
  });

  const [participants, setParticipants] = useState<ParticipantRow[]>(
    initial?.participants?.length
      ? initial.participants.map((p) => ({ ...EMPTY_PARTICIPANT, ...p }))
      : [{ ...EMPTY_PARTICIPANT }],
  );
  const [actionPoints, setActionPoints] = useState<ActionPointRow[]>(
    (initial?.actionPoints ?? []).map((a) => ({ ...EMPTY_ACTION_POINT, ...a, dueDate: formatDateInput(a.dueDate) })),
  );

  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffUnavailable, setStaffUnavailable] = useState(false);
  const [staffPick, setStaffPick] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the fixed job context (from ?jobId= or the record being edited).
  useEffect(() => {
    if (!jobId || jobSummary) return;
    setJobLoading(true);
    api
      .get<{ id: string; jobNumber: string; customer: { id: string; companyName: string }; site: { id: string; name: string } }>(
        `/api/jobs/${jobId}`,
      )
      .then((job) => setJobSummary({ id: job.id, jobNumber: job.jobNumber, customer: job.customer, site: job.site }))
      .catch(() => toast.error("Could not load the linked service job"))
      .finally(() => setJobLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Cascading customer → site → job pickers, only needed when no job context was supplied.
  useEffect(() => {
    if (jobId) return;
    api.get<CustomerOption[]>("/api/customers/options").then(setCustomers).catch(() => undefined);
  }, [jobId]);

  useEffect(() => {
    if (jobId || !customerId) {
      setSites([]);
      return;
    }
    api.get<SiteOption[]>(`/api/sites/options${qs({ customerId })}`).then(setSites).catch(() => undefined);
  }, [jobId, customerId]);

  useEffect(() => {
    if (jobId || !customerId) {
      setJobOptions([]);
      return;
    }
    api
      .list<JobOption>(`/api/jobs${qs({ customerId, siteId: siteId || undefined, pageSize: 100 })}`)
      .then((r) => setJobOptions(r.items))
      .catch(() => undefined);
  }, [jobId, customerId, siteId]);

  // Site visits for the current job, for the optional "raised during visit" link.
  useEffect(() => {
    const targetJobId = jobId || jobSummary?.id;
    if (!targetJobId) {
      setSiteVisits([]);
      return;
    }
    api
      .list<SiteVisitOption>(`/api/visits${qs({ jobId: targetJobId, pageSize: 50 })}`)
      .then((r) => setSiteVisits(r.items))
      .catch(() => undefined);
  }, [jobId, jobSummary?.id]);

  useEffect(() => {
    api.get<StaffOption[]>("/api/staff/options").then(setStaff).catch(() => setStaffUnavailable(true));
  }, []);

  const pickJob = (chosenId: string) => {
    if (!chosenId) return;
    const found = jobOptions.find((j) => j.id === chosenId);
    const customer = customers.find((c) => c.id === customerId);
    const site = sites.find((s) => s.id === siteId);
    setJobId(chosenId);
    if (found && customer && site) {
      setJobSummary({ id: chosenId, jobNumber: found.jobNumber, customer, site: { id: site.id, name: site.name } });
    }
  };

  const set = (k: keyof MomFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const setParticipant = (idx: number, patch: Partial<ParticipantRow>) =>
    setParticipants((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addParticipant = (base?: Partial<ParticipantRow>) =>
    setParticipants((rows) => [...rows, { ...EMPTY_PARTICIPANT, ...base }]);
  const removeParticipant = (idx: number) => setParticipants((rows) => rows.filter((_, i) => i !== idx));

  const addStaffParticipant = () => {
    const person = staff.find((s) => s.id === staffPick);
    if (!person) return;
    addParticipant({
      name: person.name,
      designation: person.designation ?? "",
      company: "TULSI ENGINEERS",
      party: "TULSI_ENGINEERS",
      mobile: person.mobile ?? "",
      email: person.email ?? "",
    });
    setStaffPick("");
  };

  const setActionPoint = (idx: number, patch: Partial<ActionPointRow>) =>
    setActionPoints((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addActionPoint = () => setActionPoints((rows) => [...rows, { ...EMPTY_ACTION_POINT }]);
  const removeActionPoint = (idx: number) => setActionPoints((rows) => rows.filter((_, i) => i !== idx));

  const save = async (submitAfter: boolean) => {
    if (!jobId) {
      setFormError("Select the service job this meeting relates to.");
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = {
        jobId,
        siteVisitId: siteVisitId || undefined,
        ...values,
        participants: participants.filter((p) => p.name.trim()),
        actionPoints: actionPoints
          .filter((a) => a.actionPoint.trim())
          .map((a) => ({ ...a, dueDate: a.dueDate || undefined })),
      };
      const saved = momId
        ? await api.put<{ id: string }>(`/api/mom/${momId}`, payload)
        : await api.post<{ id: string }>("/api/mom", payload);

      if (submitAfter) {
        await api.post(`/api/mom/${saved.id}/submit`);
        toast.success("MOM submitted");
      } else {
        toast.success(momId ? "MOM updated" : "MOM saved as draft");
      }
      router.push(`/mom/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        const firstFieldMessage = err.fields ? Object.values(err.fields)[0] : undefined;
        setFormError(firstFieldMessage ?? (err.fields ? null : err.message));
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setBusy(false);
    }
  };

  const canSubmit = !momId || initial?.status === "DRAFT";

  return (
    <div className="space-y-5">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Card title="Meeting details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service job" required error={errors.jobId} className="sm:col-span-2">
            {jobId ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {jobLoading ? (
                    "Loading job…"
                  ) : jobSummary ? (
                    <>
                      <span className="font-semibold text-slate-800">{jobSummary.jobNumber}</span>
                      <span className="text-slate-500"> — {jobSummary.customer.companyName} · {jobSummary.site.name}</span>
                    </>
                  ) : (
                    jobId
                  )}
                </span>
                {!momId && (
                  <button
                    type="button"
                    onClick={() => { setJobId(""); setJobSummary(null); }}
                    className="text-xs font-medium text-slate-500 hover:text-[var(--te-primary)]"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSiteId(""); }}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </Select>
                <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!customerId}>
                  <option value="">All sites</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Select value="" onChange={(e) => pickJob(e.target.value)} disabled={!customerId}>
                  <option value="">Select job</option>
                  {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.jobNumber}</option>)}
                </Select>
              </div>
            )}
          </Field>

          <Field label="Related site visit" hint="Optional">
            <Select value={siteVisitId} onChange={(e) => setSiteVisitId(e.target.value)} disabled={!siteVisits.length}>
              <option value="">Not linked to a specific visit</option>
              {siteVisits.map((v) => <option key={v.id} value={v.id}>{v.visitNumber} — {formatDateInput(v.visitDate)}</option>)}
            </Select>
          </Field>
          <Field label="Meeting date" required error={errors.meetingDate}>
            <Input type="date" value={values.meetingDate} onChange={set("meetingDate")} required />
          </Field>
          <Field label="Meeting time" error={errors.meetingTime}>
            <Input type="time" value={values.meetingTime} onChange={set("meetingTime")} />
          </Field>
          <Field label="Location" error={errors.location}>
            <Input value={values.location} onChange={set("location")} placeholder="Site office / Boiler house…" />
          </Field>
          <Field label="Equipment" error={errors.equipmentDetails}>
            <Input value={values.equipmentDetails} onChange={set("equipmentDetails")} placeholder="Leave blank to use the job's equipment" />
          </Field>
          <Field label="Purpose" error={errors.purpose} className="sm:col-span-2">
            <Textarea value={values.purpose} onChange={set("purpose")} rows={2} />
          </Field>
        </div>
      </Card>

      <Card
        title={`Participants (${participants.length})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!staffUnavailable && staff.length > 0 && (
              <>
                <Select value={staffPick} onChange={(e) => setStaffPick(e.target.value)} className="h-8 w-48 py-1 text-xs">
                  <option value="">Add team member…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addStaffParticipant} disabled={!staffPick}>
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => addParticipant()}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
          </div>
        }
      >
        {staffUnavailable && (
          <p className="mb-3 text-xs text-slate-500">Staff directory is unavailable right now — add participants manually.</p>
        )}
        <div className="space-y-3">
          {participants.map((p, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
              <Input className="sm:col-span-2" placeholder="Name" value={p.name} onChange={(e) => setParticipant(idx, { name: e.target.value })} />
              <Input placeholder="Designation" value={p.designation} onChange={(e) => setParticipant(idx, { designation: e.target.value })} />
              <Input placeholder="Company" value={p.company} onChange={(e) => setParticipant(idx, { company: e.target.value })} />
              <Select value={p.party} onChange={(e) => setParticipant(idx, { party: e.target.value as Party })}>
                {Object.entries(RESPONSIBLE_PARTY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <div className="flex items-center gap-2">
                <Input placeholder="Mobile" value={p.mobile} onChange={(e) => setParticipant(idx, { mobile: e.target.value })} />
                <button
                  type="button"
                  onClick={() => removeParticipant(idx)}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="Remove participant"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input className="sm:col-span-3" placeholder="Email" type="email" value={p.email} onChange={(e) => setParticipant(idx, { email: e.target.value })} />
            </div>
          ))}
          {participants.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No participants added yet.</p>}
        </div>
      </Card>

      <Card title="Discussion">
        <div className="grid gap-4">
          <Field label="Discussion points" error={errors.discussionPoints}>
            <Textarea value={values.discussionPoints} onChange={set("discussionPoints")} rows={4} />
          </Field>
          <Field label="Technical observations" error={errors.technicalObservations}>
            <Textarea value={values.technicalObservations} onChange={set("technicalObservations")} rows={4} />
          </Field>
          <Field label="Problems identified" error={errors.problemsIdentified}>
            <Textarea value={values.problemsIdentified} onChange={set("problemsIdentified")} rows={4} />
          </Field>
          <Field label="Decisions taken" error={errors.decisionsTaken}>
            <Textarea value={values.decisionsTaken} onChange={set("decisionsTaken")} rows={4} />
          </Field>
          <Field label="Recommendations" error={errors.recommendations}>
            <Textarea value={values.recommendations} onChange={set("recommendations")} rows={3} />
          </Field>
        </div>
      </Card>

      <Card title="Materials, spares & closing notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required materials" error={errors.requiredMaterials}>
            <Textarea value={values.requiredMaterials} onChange={set("requiredMaterials")} rows={2} />
          </Field>
          <Field label="Required spares" error={errors.requiredSpares}>
            <Textarea value={values.requiredSpares} onChange={set("requiredSpares")} rows={2} />
          </Field>
          <Field label="Pending points" error={errors.pendingPoints}>
            <Textarea value={values.pendingPoints} onChange={set("pendingPoints")} rows={2} />
          </Field>
          <Field label="Client remarks" error={errors.clientRemarks}>
            <Textarea value={values.clientRemarks} onChange={set("clientRemarks")} rows={2} />
          </Field>
        </div>
      </Card>

      <Card
        title={`Action points (${actionPoints.length})`}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={addActionPoint}>
            <Plus className="h-3.5 w-3.5" /> Add action point
          </Button>
        }
      >
        <div className="space-y-3">
          {actionPoints.map((a, idx) => (
            <div key={a.id ?? idx} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2">
                <Textarea
                  className="flex-1"
                  rows={2}
                  placeholder="What needs to be done…"
                  value={a.actionPoint}
                  onChange={(e) => setActionPoint(idx, { actionPoint: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeActionPoint(idx)}
                  className="mt-2 shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="Remove action point"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-6">
                <Input
                  className="sm:col-span-2"
                  placeholder="Responsible person"
                  value={a.responsiblePerson}
                  onChange={(e) => setActionPoint(idx, { responsiblePerson: e.target.value })}
                />
                <Select value={a.responsibleParty} onChange={(e) => setActionPoint(idx, { responsibleParty: e.target.value as Party })}>
                  {Object.entries(RESPONSIBLE_PARTY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                <Input placeholder="Company" value={a.responsibleCompany} onChange={(e) => setActionPoint(idx, { responsibleCompany: e.target.value })} />
                <Input type="date" value={a.dueDate} onChange={(e) => setActionPoint(idx, { dueDate: e.target.value })} />
                <Select value={a.priority} onChange={(e) => setActionPoint(idx, { priority: e.target.value as PriorityValue })}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              {momId && (
                <Select
                  value={a.status}
                  onChange={(e) => setActionPoint(idx, { status: e.target.value as ActionStatus })}
                  className="h-8 w-48 py-1 text-xs"
                >
                  {Object.entries(ACTION_POINT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </div>
          ))}
          {actionPoints.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No action points yet.</p>}
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" onClick={() => save(false)} loading={busy}>
          Save as draft
        </Button>
        {canSubmit && (
          <Button type="button" onClick={() => save(true)} loading={busy}>
            Save &amp; submit
          </Button>
        )}
      </div>
    </div>
  );
}

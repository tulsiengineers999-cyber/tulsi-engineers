"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button, Select, Field, Input, Badge, Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client-api";
import { ACTION_POINT_STATUS_LABELS, PRIORITY_LABELS, RESPONSIBLE_PARTY_LABELS } from "@/lib/masters";
import { ACTION_POINT_TONE, PRIORITY_TONE } from "@/lib/ui";
import { formatDate } from "@/lib/format";

export interface ActionPointItem {
  id: string;
  sequence: number;
  actionPoint: string;
  responsiblePerson: string | null;
  responsibleParty: string;
  responsibleCompany: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  generatedJob: { id: string; jobNumber: string } | null;
}

export function ActionPointsPanel({
  items,
  canEdit,
  canConvert,
}: {
  items: ActionPointItem[];
  canEdit: boolean;
  canConvert: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [converting, setConverting] = useState<ActionPointItem | null>(null);

  const updateStatus = async (id: string, status: string) => {
    const previous = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      await api.patch(`/api/action-points/${id}`, { status });
      toast.success("Status updated");
    } catch (err) {
      setRows(previous);
      toast.error("Could not update status", err instanceof ApiError ? err.message : undefined);
    }
  };

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No action points recorded for this meeting.</p>;
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Action point</th>
              <th className="px-3 py-2.5">Responsible</th>
              <th className="px-3 py-2.5">Due date</th>
              <th className="px-3 py-2.5">Priority</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 text-slate-500">{r.sequence}</td>
                <td className="max-w-xs px-3 py-3 whitespace-pre-line text-slate-800">{r.actionPoint}</td>
                <td className="px-3 py-3 text-slate-600">
                  {r.responsiblePerson || RESPONSIBLE_PARTY_LABELS[r.responsibleParty] || r.responsibleParty}
                  {r.responsibleCompany && <span className="block text-xs text-slate-400">{r.responsibleCompany}</span>}
                </td>
                <td className="px-3 py-3 text-slate-600">{formatDate(r.dueDate)}</td>
                <td className="px-3 py-3">
                  <Badge tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABELS[r.priority] ?? r.priority}</Badge>
                </td>
                <td className="px-3 py-3">
                  {canEdit ? (
                    <Select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="h-8 w-40 py-1 text-xs">
                      {Object.entries(ACTION_POINT_STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={ACTION_POINT_TONE[r.status]}>{ACTION_POINT_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.generatedJob ? (
                    <Link href={`/jobs/${r.generatedJob.id}`} className="text-xs font-medium text-[var(--te-primary)] hover:underline">
                      {r.generatedJob.jobNumber}
                    </Link>
                  ) : canConvert ? (
                    <Button variant="outline" size="sm" onClick={() => setConverting(r)}>
                      Convert to job
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {converting && (
        <ConvertModal
          actionPoint={converting}
          onClose={() => setConverting(null)}
          onConverted={(job) => {
            setRows((r) => r.map((x) => (x.id === converting.id ? { ...x, generatedJob: job, status: "IN_PROGRESS" } : x)));
            setConverting(null);
            toast.success("Service job created", job.jobNumber);
            router.push(`/jobs/${job.id}`);
          }}
        />
      )}
    </>
  );
}

interface ServiceTypeOption {
  id: string;
  name: string;
  category: string | null;
}
interface StaffOption {
  id: string;
  name: string;
}

function ConvertModal({
  actionPoint,
  onClose,
  onConverted,
}: {
  actionPoint: ActionPointItem;
  onClose: () => void;
  onConverted: (job: { id: string; jobNumber: string }) => void;
}) {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [engineers, setEngineers] = useState<StaffOption[]>([]);
  const [serviceTypesError, setServiceTypesError] = useState(false);
  const [engineersError, setEngineersError] = useState(false);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [priority, setPriority] = useState(actionPoint.priority);
  const [plannedVisitDate, setPlannedVisitDate] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ServiceTypeOption[]>("/api/service-types/options").then(setServiceTypes).catch(() => setServiceTypesError(true));
    api.get<StaffOption[]>("/api/staff/options").then(setEngineers).catch(() => setEngineersError(true));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceTypeId) {
      setError("Select the type of service this job is for.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const job = await api.post<{ id: string; jobNumber: string }>(`/api/action-points/${actionPoint.id}/convert`, {
        serviceTypeId,
        priority,
        plannedVisitDate: plannedVisitDate || undefined,
        targetCompletionDate: targetCompletionDate || undefined,
        engineerId: engineerId || undefined,
      });
      onConverted(job);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Convert to service job"
      description={actionPoint.actionPoint}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button form="convert-action-point-form" type="submit" loading={busy}>
            Create job
          </Button>
        </>
      }
    >
      <form id="convert-action-point-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Service type" required>
          <Select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} required disabled={serviceTypesError}>
            <option value="">{serviceTypesError ? "Service types unavailable" : "Select service type"}</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          {serviceTypesError && <p className="mt-1 text-xs text-amber-600">Could not load service types. Please try again shortly.</p>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Engineer" hint="Optional">
            <Select value={engineerId} onChange={(e) => setEngineerId(e.target.value)} disabled={engineersError}>
              <option value="">{engineersError ? "Staff directory unavailable" : "Unassigned"}</option>
              {engineers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Planned visit date">
            <Input type="date" value={plannedVisitDate} onChange={(e) => setPlannedVisitDate(e.target.value)} />
          </Field>
          <Field label="Target completion date">
            <Input type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

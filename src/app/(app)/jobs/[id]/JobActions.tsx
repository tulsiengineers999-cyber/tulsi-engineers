"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, UserCheck, GitBranch, CarFront, FileText, CalendarDays, FileCheck2, Trash2,
} from "lucide-react";
import { Button, LinkButton, Field, Select, Textarea, Input, Alert, Checkbox } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { JobFormModal, type JobFormValues } from "../JobFormModal";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatDateInput } from "@/lib/format";
import { JOB_STATUS_FLOW, JOB_STATUS_LABELS } from "@/lib/masters";

interface StaffOption {
  id: string;
  name: string;
  isEngineer: boolean;
  isTechnician: boolean;
}

interface JobRecord {
  id: string;
  jobNumber: string;
  status: string;
  progressPercent: number;
  customerId: string;
  siteId: string;
  equipmentId: string | null;
  serviceTypeId: string;
  priority: JobFormValues["priority"];
  requestDate: string | null;
  plannedVisitDate: string | null;
  targetCompletionDate: string | null;
  customerRequirement: string | null;
  problemDescription: string | null;
  jobDescription: string | null;
  requiredMaterial: string | null;
  requiredSpare: string | null;
  remarks: string | null;
  engineerId: string | null;
  technicianId: string | null;
}

export interface JobPermissions {
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canCreateVisit: boolean;
  canCreateMom: boolean;
  canCreateDaily: boolean;
  canCreateFinal: boolean;
}

/**
 * Which statuses a user may move to from the current one.
 * Mirrors the rule enforced server-side in /api/jobs/[id]/status:
 * any later step, one step back, CANCELLED before completion, CLOSED after it.
 */
function allowedNextStatuses(current: string): string[] {
  const index = JOB_STATUS_FLOW.indexOf(current);
  if (current === "CANCELLED") return [];
  if (index === -1) return JOB_STATUS_FLOW;

  const out = JOB_STATUS_FLOW.filter((_, i) => i > index);
  if (index > 0) out.unshift(JOB_STATUS_FLOW[index - 1]);
  if (JOB_STATUS_FLOW.indexOf("COMPLETED") > index) out.push("CANCELLED");
  return [...new Set(out)];
}

export function JobActions({
  job,
  staff,
  permissions,
}: {
  job: JobRecord;
  staff: StaffOption[];
  permissions: JobPermissions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [assign, setAssign] = useState({
    engineerId: job.engineerId ?? "",
    technicianId: job.technicianId ?? "",
    plannedVisitDate: formatDateInput(job.plannedVisitDate),
    remarks: "",
    notify: true,
  });

  const nextStatuses = allowedNextStatuses(job.status);
  const [status, setStatus] = useState({
    status: nextStatuses[nextStatuses.length - 1] ?? job.status,
    remarks: "",
    progressPercent: String(job.progressPercent),
  });

  const engineers = staff.filter((s) => s.isEngineer);
  const technicians = staff.filter((s) => s.isTechnician);

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/jobs/${job.id}/assign`, assign);
      toast.success("Job assigned", "The assigned team has been notified.");
      setAssignOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not assign this job", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const submitStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/jobs/${job.id}/status`, {
        status: status.status,
        remarks: status.remarks,
        progressPercent: Number(status.progressPercent),
      });
      toast.success("Status updated", JOB_STATUS_LABELS[status.status]);
      setStatusOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not change the status", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/api/jobs/${job.id}`);
      toast.success("Job deleted");
      router.push("/jobs");
      router.refresh();
    } catch (err) {
      toast.error("Could not delete this job", err instanceof ApiError ? err.message : undefined);
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="grid gap-2">
        {permissions.canAssign && (
          <Button variant="primary" onClick={() => setAssignOpen(true)}>
            <UserCheck className="h-4 w-4" /> Assign engineer
          </Button>
        )}
        {permissions.canEdit && nextStatuses.length > 0 && (
          <Button variant="accent" onClick={() => setStatusOpen(true)}>
            <GitBranch className="h-4 w-4" /> Change status
          </Button>
        )}
        {permissions.canCreateVisit && (
          <LinkButton href={`/visits/new?jobId=${job.id}`} variant="outline">
            <CarFront className="h-4 w-4" /> New site visit
          </LinkButton>
        )}
        {permissions.canCreateMom && (
          <LinkButton href={`/mom/new?jobId=${job.id}`} variant="outline">
            <FileText className="h-4 w-4" /> New MOM
          </LinkButton>
        )}
        {permissions.canCreateDaily && (
          <LinkButton href={`/daily-reports/new?jobId=${job.id}`} variant="outline">
            <CalendarDays className="h-4 w-4" /> Add daily work
          </LinkButton>
        )}
        {permissions.canCreateFinal && (
          <LinkButton href={`/final-reports/new?jobId=${job.id}`} variant="outline">
            <FileCheck2 className="h-4 w-4" /> Final service report
          </LinkButton>
        )}
        {permissions.canEdit && (
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit job details
          </Button>
        )}
        {permissions.canDelete && (
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Delete job
          </Button>
        )}
      </div>

      <JobFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
        initial={{
          id: job.id,
          customerId: job.customerId,
          siteId: job.siteId,
          equipmentId: job.equipmentId ?? "",
          serviceTypeId: job.serviceTypeId,
          priority: job.priority,
          requestDate: formatDateInput(job.requestDate),
          plannedVisitDate: formatDateInput(job.plannedVisitDate),
          targetCompletionDate: formatDateInput(job.targetCompletionDate),
          customerRequirement: job.customerRequirement ?? "",
          problemDescription: job.problemDescription ?? "",
          jobDescription: job.jobDescription ?? "",
          requiredMaterial: job.requiredMaterial ?? "",
          requiredSpare: job.requiredSpare ?? "",
          remarks: job.remarks ?? "",
        }}
      />

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign this job"
        description={`${job.jobNumber} — choose who will attend the site.`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={busy}>Cancel</Button>
            <Button form="assign-form" type="submit" loading={busy}>Assign</Button>
          </>
        }
      >
        <form id="assign-form" onSubmit={submitAssign} className="space-y-4">
          <Field label="Service engineer">
            <Select value={assign.engineerId} onChange={(e) => setAssign((a) => ({ ...a, engineerId: e.target.value }))}>
              <option value="">Not assigned</option>
              {engineers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Technician">
            <Select value={assign.technicianId} onChange={(e) => setAssign((a) => ({ ...a, technicianId: e.target.value }))}>
              <option value="">Not assigned</option>
              {technicians.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Planned visit date">
            <Input
              type="date"
              value={assign.plannedVisitDate}
              onChange={(e) => setAssign((a) => ({ ...a, plannedVisitDate: e.target.value }))}
            />
          </Field>
          <Field label="Instructions for the team">
            <Textarea
              rows={2}
              value={assign.remarks}
              onChange={(e) => setAssign((a) => ({ ...a, remarks: e.target.value }))}
              placeholder="Carry gauge glasses and a spare safety valve spring. Gate pass needed."
            />
          </Field>
          <Checkbox
            checked={assign.notify}
            onChange={(e) => setAssign((a) => ({ ...a, notify: e.target.checked }))}
            label="Notify the assigned team by email"
            description="They will also see this job in their field view immediately."
          />
        </form>
      </Modal>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change job status"
        description={`Currently ${JOB_STATUS_LABELS[job.status] ?? job.status}.`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={busy}>Cancel</Button>
            <Button form="status-form" type="submit" loading={busy}>Update status</Button>
          </>
        }
      >
        <form id="status-form" onSubmit={submitStatus} className="space-y-4">
          {nextStatuses.length === 0 ? (
            <Alert tone="warning">This job is cancelled and its status can no longer be changed.</Alert>
          ) : (
            <>
              <Field label="New status" required>
                <Select value={status.status} onChange={(e) => setStatus((s) => ({ ...s, status: e.target.value }))}>
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{JOB_STATUS_LABELS[s] ?? s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Progress" hint="0–100%">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={status.progressPercent}
                  onChange={(e) => setStatus((s) => ({ ...s, progressPercent: e.target.value }))}
                />
              </Field>
              <Field label="Remarks">
                <Textarea
                  rows={2}
                  value={status.remarks}
                  onChange={(e) => setStatus((s) => ({ ...s, remarks: e.target.value }))}
                  placeholder="Reason for the change — recorded in the job history."
                />
              </Field>
            </>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        loading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete this job?"
        confirmLabel="Delete job"
        message={
          <>
            <b>{job.jobNumber}</b> will be removed from lists and searches. Jobs that already have site visits,
            MOMs or reports cannot be deleted — cancel them instead so the record and its history are preserved.
          </>
        }
      />
    </>
  );
}

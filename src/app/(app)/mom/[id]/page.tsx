import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, EmptyState } from "@/components/ui/primitives";
import { PhotoGallery, type GalleryPhoto } from "@/components/ui/PhotoUploader";
import { MomActions, type MomActionsPermissions } from "./MomActions";
import { ActionPointsPanel } from "./ActionPointsPanel";
import { formatDate, titleCase } from "@/lib/format";
import { DOC_STATUS_TONE, CONFIRMATION_TONE, CHANNEL_TONE } from "@/lib/ui";
import { DOC_STATUS_LABELS, RESPONSIBLE_PARTY_LABELS } from "@/lib/masters";

export default async function MomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("mom.view");
  const { id } = await params;

  const mom = await prisma.mom.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      site: true,
      job: { include: { serviceType: true, equipment: true } },
      participants: { orderBy: { createdAt: "asc" } },
      actionPoints: { orderBy: { sequence: "asc" }, include: { generatedJob: { select: { id: true, jobNumber: true } } } },
      photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!mom) notFound();

  const [confirmations, emailLogs, whatsappLogs] = await Promise.all([
    prisma.clientConfirmation.findMany({ where: { docType: "MOM", recordId: id }, orderBy: { createdAt: "desc" } }),
    prisma.emailLog.findMany({ where: { docType: "MOM", recordId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.whatsappLog.findMany({ where: { docType: "MOM", recordId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const permissions: MomActionsPermissions = {
    canEdit: can(user.permissions, "mom.edit"),
    canSubmit: can(user.permissions, "mom.approve") || can(user.permissions, "mom.edit"),
    canPdf: can(user.permissions, "mom.pdf"),
    canDownload: can(user.permissions, "mom.download"),
    canPrint: can(user.permissions, "mom.print"),
    canSend: can(user.permissions, "mom.email") || can(user.permissions, "mom.whatsapp"),
    canDelete: can(user.permissions, "mom.delete"),
  };
  const canConvert = can(user.permissions, "jobs.create");

  const defaultEmail = mom.site.email ?? mom.customer.email ?? null;
  const defaultWhatsapp = mom.site.whatsapp ?? mom.customer.whatsapp ?? mom.site.mobile ?? mom.customer.mobile ?? null;

  const photos: GalleryPhoto[] = mom.photos.map((p) => ({
    id: p.id,
    category: p.category,
    fileName: p.fileName,
    description: p.description,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy,
  }));

  const commHistory = [
    ...emailLogs.map((e) => ({
      id: `email-${e.id}`,
      title: `Emailed to ${e.toEmail}`,
      description: e.errorMessage ?? e.bodyPreview,
      at: e.createdAt,
      status: e.status,
    })),
    ...whatsappLogs.map((w) => ({
      id: `wa-${w.id}`,
      title: `WhatsApp sent to ${w.toNumber}`,
      description: w.errorMessage ?? w.bodyPreview,
      at: w.createdAt,
      status: w.status,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <PageHeader
        title={mom.momNumber}
        description={`${mom.customer.companyName} · ${mom.site.name} · Job ${mom.job.jobNumber}`}
        crumbs={[{ label: "MOM", href: "/mom" }, { label: mom.momNumber }]}
        actions={
          <>
            <Badge tone="neutral">v{mom.version}</Badge>
            <Badge tone={DOC_STATUS_TONE[mom.status]}>{DOC_STATUS_LABELS[mom.status] ?? mom.status}</Badge>
            <MomActions
              mom={{ id: mom.id, momNumber: mom.momNumber, status: mom.status, defaultEmail, defaultWhatsapp }}
              permissions={permissions}
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Meeting details">
            <DetailGrid>
              <DetailRow label="Customer">
                <Link href={`/customers/${mom.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {mom.customer.companyName}
                </Link>
              </DetailRow>
              <DetailRow label="Site">
                <Link href={`/sites/${mom.site.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {mom.site.name}
                </Link>
              </DetailRow>
              <DetailRow label="Service job">
                <Link href={`/jobs/${mom.job.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {mom.job.jobNumber}
                </Link>
              </DetailRow>
              <DetailRow label="Service type">{mom.job.serviceType.name}</DetailRow>
              <DetailRow label="Equipment">{mom.equipmentDetails ?? mom.job.equipment?.name}</DetailRow>
              <DetailRow label="Meeting date">{formatDate(mom.meetingDate)}</DetailRow>
              <DetailRow label="Meeting time">{mom.meetingTime}</DetailRow>
              <DetailRow label="Location">{mom.location}</DetailRow>
              <DetailRow label="Purpose" className="sm:col-span-2">{mom.purpose}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title={`Participants (${mom.participants.length})`} bodyClassName={mom.participants.length ? "p-0" : undefined}>
            {mom.participants.length === 0 ? (
              <EmptyState title="No participants recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      <th className="px-4 py-2.5 sm:px-5">Name</th>
                      <th className="px-4 py-2.5 sm:px-5">Designation</th>
                      <th className="px-4 py-2.5 sm:px-5">Company</th>
                      <th className="px-4 py-2.5 sm:px-5">Party</th>
                      <th className="px-4 py-2.5 sm:px-5">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mom.participants.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium text-slate-800 sm:px-5">{p.name}</td>
                        <td className="px-4 py-3 text-slate-600 sm:px-5">{p.designation ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600 sm:px-5">{p.company ?? "—"}</td>
                        <td className="px-4 py-3 sm:px-5">
                          <Badge tone={p.party === "TULSI_ENGINEERS" ? "primary" : "neutral"}>{RESPONSIBLE_PARTY_LABELS[p.party]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 sm:px-5">{[p.mobile, p.email].filter(Boolean).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Discussion">
            <DetailGrid cols={1}>
              <DetailRow label="Discussion points">{mom.discussionPoints}</DetailRow>
              <DetailRow label="Technical observations">{mom.technicalObservations}</DetailRow>
              <DetailRow label="Problems identified">{mom.problemsIdentified}</DetailRow>
              <DetailRow label="Decisions taken">{mom.decisionsTaken}</DetailRow>
              <DetailRow label="Recommendations">{mom.recommendations}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title="Materials, spares & closing notes">
            <DetailGrid>
              <DetailRow label="Required materials">{mom.requiredMaterials}</DetailRow>
              <DetailRow label="Required spares">{mom.requiredSpares}</DetailRow>
              <DetailRow label="Pending points">{mom.pendingPoints}</DetailRow>
              <DetailRow label="Client remarks">{mom.clientRemarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card title={`Action points (${mom.actionPoints.length})`} bodyClassName={mom.actionPoints.length ? "p-0" : undefined}>
            <ActionPointsPanel
              items={mom.actionPoints.map((a) => ({
                id: a.id,
                sequence: a.sequence,
                actionPoint: a.actionPoint,
                responsiblePerson: a.responsiblePerson,
                responsibleParty: a.responsibleParty,
                responsibleCompany: a.responsibleCompany,
                dueDate: a.dueDate ? a.dueDate.toISOString() : null,
                priority: a.priority,
                status: a.status,
                generatedJob: a.generatedJob,
              }))}
              canEdit={permissions.canEdit}
              canConvert={canConvert}
            />
          </Card>

          <Card title={`Photos (${photos.length})`}>
            {photos.length === 0 ? (
              <EmptyState icon={Camera} title="No photos uploaded yet" />
            ) : (
              <PhotoGallery photos={photos} />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Client confirmation">
            {confirmations.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Not sent to the client yet.</p>
            ) : (
              <ul className="space-y-3">
                {confirmations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={CONFIRMATION_TONE[c.status]}>{titleCase(c.status)}</Badge>
                      <span className="text-xs text-slate-400">v{c.version}</span>
                    </div>
                    {c.clientName && <p className="mt-1.5 font-medium text-slate-800">{c.clientName}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[c.clientMobile, c.clientEmail].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {c.confirmedAt && <p className="mt-1 text-xs text-slate-400">Confirmed {formatDate(c.confirmedAt)}</p>}
                    {c.correctionRemarks && <p className="mt-1 text-xs text-amber-700">{c.correctionRemarks}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Communication history">
            {commHistory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nothing sent yet.</p>
            ) : (
              <div className="space-y-2">
                {commHistory.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{entry.title}</span>
                      <Badge tone={CHANNEL_TONE[entry.status] ?? "neutral"}>{titleCase(entry.status)}</Badge>
                    </div>
                    <p className="mt-0.5 text-slate-500">{formatDate(entry.at)}</p>
                    {entry.description && <p className="mt-1 text-slate-500">{entry.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Record info">
            <DetailGrid cols={1}>
              <DetailRow label="Created by">{mom.createdBy?.name}</DetailRow>
              <DetailRow label="Created on">{formatDate(mom.createdAt)}</DetailRow>
              <DetailRow label="Submitted on">{formatDate(mom.submittedAt)}</DetailRow>
              <DetailRow label="Sent on">{formatDate(mom.sentAt)}</DetailRow>
              <DetailRow label="Confirmed on">{formatDate(mom.confirmedAt)}</DetailRow>
            </DetailGrid>
          </Card>
        </div>
      </div>
    </>
  );
}

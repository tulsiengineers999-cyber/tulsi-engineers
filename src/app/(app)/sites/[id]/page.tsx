import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Cog, ClipboardList, Mail, Phone, MessageSquare, Plus, Navigation } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, LinkButton, EmptyState } from "@/components/ui/primitives";
import { SiteActions } from "./SiteActions";
import { formatDate } from "@/lib/format";
import { AMC_TONE, JOB_STATUS_TONE } from "@/lib/ui";
import { AMC_STATUS_LABELS, EQUIPMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/lib/masters";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("sites.view");
  const { id } = await params;

  const site = await prisma.site.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, code: true, companyName: true, mobile: true, email: true } },
      equipment: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: { _count: { select: { jobs: true } } },
      },
      jobs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { serviceType: { select: { name: true } }, engineer: { select: { name: true } } },
      },
    },
  });
  if (!site) notFound();

  const mapUrl = site.latitude != null && site.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`
    : null;

  return (
    <>
      <PageHeader
        title={site.name}
        description={`${site.code} · ${site.customer.companyName}`}
        crumbs={[{ label: "Sites", href: "/sites" }, { label: site.name }]}
        actions={<SiteActions site={JSON.parse(JSON.stringify(site))} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Site details">
            <DetailGrid>
              <DetailRow label="Site code">{site.code}</DetailRow>
              <DetailRow label="Status">
                <Badge tone={site.status === "ACTIVE" ? "success" : "neutral"} dot>
                  {site.status === "ACTIVE" ? "Active" : "Inactive"}
                </Badge>
              </DetailRow>
              <DetailRow label="Customer">
                <Link href={`/customers/${site.customer.id}`} className="font-medium text-[var(--te-primary)] hover:underline">
                  {site.customer.companyName}
                </Link>
              </DetailRow>
              <DetailRow label="Site type">{site.siteType}</DetailRow>
              <DetailRow label="Contact person">{site.contactPerson}</DetailRow>
              <DetailRow label="Mobile">{site.mobile}</DetailRow>
              <DetailRow label="WhatsApp">{site.whatsapp}</DetailRow>
              <DetailRow label="Email">{site.email}</DetailRow>
              <DetailRow label="Address">
                {[site.address, site.city, site.state, site.pinCode].filter(Boolean).join(", ")}
              </DetailRow>
              <DetailRow label="Map location">
                {mapUrl ? (
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--te-primary)] hover:underline">
                    <Navigation className="h-3.5 w-3.5" /> {site.latitude?.toFixed(6)}, {site.longitude?.toFixed(6)}
                  </a>
                ) : undefined}
              </DetailRow>
              <DetailRow label="Remarks">{site.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card
            title={`Equipment (${site.equipment.length})`}
            actions={<LinkButton href={`/equipment?siteId=${site.id}`} variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Add equipment</LinkButton>}
            bodyClassName={site.equipment.length ? "p-0" : undefined}
          >
            {site.equipment.length === 0 ? (
              <EmptyState icon={Cog} title="No equipment recorded" description="Add equipment installed at this site." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {site.equipment.map((e) => (
                  <li key={e.id}>
                    <Link href={`/equipment/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{e.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {EQUIPMENT_TYPE_LABELS[e.type]}
                          {e.serialNumber ? ` · Sr. ${e.serialNumber}` : ""} · {e._count.jobs} job(s)
                        </span>
                      </span>
                      <Badge tone={AMC_TONE[e.amcStatus]}>{AMC_STATUS_LABELS[e.amcStatus]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Service jobs (${site.jobs.length})`} bodyClassName={site.jobs.length ? "p-0" : undefined}>
            {site.jobs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No service jobs yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {site.jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{j.jobNumber}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {j.serviceType.name}{j.engineer ? ` · ${j.engineer.name}` : ""} · {formatDate(j.requestDate)}
                        </span>
                      </span>
                      <Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABELS[j.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Quick actions">
            <div className="grid gap-2">
              <LinkButton href={`/jobs/new?siteId=${site.id}`} variant="primary" size="md">
                <ClipboardList className="h-4 w-4" /> New service job
              </LinkButton>
              <LinkButton href={`/equipment?siteId=${site.id}`} variant="outline" size="md">
                <Cog className="h-4 w-4" /> Manage equipment
              </LinkButton>
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <MapPin className="h-4 w-4" /> Open in Google Maps
                </a>
              )}
              {site.mobile && (
                <a href={`tel:${site.mobile}`} className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Phone className="h-4 w-4" /> Call {site.contactPerson ?? "contact"}
                </a>
              )}
              {site.whatsapp && (
                <a href={`https://wa.me/${site.whatsapp.replace(/\D/g, "").length === 10 ? `91${site.whatsapp.replace(/\D/g, "")}` : site.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {site.email && (
                <a href={`mailto:${site.email}`} className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

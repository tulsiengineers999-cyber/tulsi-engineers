import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2, MapPin, Cog, ClipboardList, Mail, Phone, MessageSquare, FileText, Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Badge, DetailRow, DetailGrid, LinkButton, EmptyState } from "@/components/ui/primitives";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { CustomerActions } from "./CustomerActions";
import { formatDate } from "@/lib/format";
import { AMC_TONE, JOB_STATUS_TONE } from "@/lib/ui";
import { AMC_STATUS_LABELS, EQUIPMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/lib/masters";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("customers.view");
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      sites: { where: { deletedAt: null }, orderBy: { name: "asc" }, include: { _count: { select: { equipment: true, jobs: true } } } },
      equipment: { where: { deletedAt: null }, orderBy: { name: "asc" }, include: { site: { select: { name: true } } } },
      jobs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { site: { select: { name: true } }, serviceType: { select: { name: true } }, engineer: { select: { name: true } } },
      },
    },
  });
  if (!customer) notFound();

  const [moms, dailyReports, finalReports, confirmations] = await Promise.all([
    prisma.mom.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { meetingDate: "desc" }, take: 20, select: { id: true, momNumber: true, meetingDate: true, status: true } }),
    prisma.dailyWorkReport.findMany({ where: { job: { customerId: id }, deletedAt: null }, orderBy: { reportDate: "desc" }, take: 20, select: { id: true, reportNumber: true, reportDate: true, status: true } }),
    prisma.finalServiceReport.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reportNumber: true, completionDate: true, status: true } }),
    prisma.clientConfirmation.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const timeline: TimelineEntry[] = [
    ...customer.jobs.map((j) => ({
      id: `job-${j.id}`, title: `Job ${j.jobNumber} — ${j.serviceType.name}`,
      description: `${j.site.name}${j.engineer ? ` · ${j.engineer.name}` : ""}`,
      at: j.createdAt, tone: "primary" as const, href: `/jobs/${j.id}`,
      meta: JOB_STATUS_LABELS[j.status],
    })),
    ...moms.map((m) => ({ id: `mom-${m.id}`, title: `MOM ${m.momNumber}`, at: m.meetingDate, tone: "warning" as const, href: `/mom/${m.id}` })),
    ...finalReports.map((f) => ({ id: `fsr-${f.id}`, title: `Final Service Report ${f.reportNumber}`, at: f.completionDate ?? new Date(), tone: "success" as const, href: `/final-reports/${f.id}` })),
    ...confirmations.filter((c) => c.confirmedAt).map((c) => ({
      id: `conf-${c.id}`, title: `Client confirmed ${c.recordNumber}`,
      description: c.clientName ? `Confirmed by ${c.clientName}` : undefined,
      at: c.confirmedAt!, tone: "success" as const,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return (
    <>
      <PageHeader
        title={customer.companyName}
        description={`${customer.code}${customer.industry ? ` · ${customer.industry}` : ""}`}
        crumbs={[{ label: "Customers", href: "/customers" }, { label: customer.companyName }]}
        actions={<CustomerActions customer={JSON.parse(JSON.stringify(customer))} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Customer details">
            <DetailGrid>
              <DetailRow label="Customer code">{customer.code}</DetailRow>
              <DetailRow label="Status">
                <Badge tone={customer.status === "ACTIVE" ? "success" : "neutral"} dot>
                  {customer.status === "ACTIVE" ? "Active" : "Inactive"}
                </Badge>
              </DetailRow>
              <DetailRow label="Contact person">{customer.contactPerson}</DetailRow>
              <DetailRow label="Designation">{customer.designation}</DetailRow>
              <DetailRow label="Mobile">{customer.mobile}</DetailRow>
              <DetailRow label="WhatsApp">{customer.whatsapp}</DetailRow>
              <DetailRow label="Email">{customer.email}</DetailRow>
              <DetailRow label="Alternate email">{customer.altEmail}</DetailRow>
              <DetailRow label="GST number">{customer.gstNumber}</DetailRow>
              <DetailRow label="Industry">{customer.industry}</DetailRow>
              <DetailRow label="Billing address">
                {[customer.billingAddress, customer.city, customer.state, customer.pinCode].filter(Boolean).join(", ")}
              </DetailRow>
              <DetailRow label="Remarks">{customer.remarks}</DetailRow>
            </DetailGrid>
          </Card>

          <Card
            title={`Sites (${customer.sites.length})`}
            actions={<LinkButton href={`/sites?customerId=${customer.id}`} variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Add site</LinkButton>}
            bodyClassName={customer.sites.length ? "p-0" : undefined}
          >
            {customer.sites.length === 0 ? (
              <EmptyState icon={MapPin} title="No sites yet" description="Add a site to record equipment and raise service jobs." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.sites.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sites/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{s.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[s.address, s.city, s.state].filter(Boolean).join(", ") || s.code}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        <span className="block">{s._count.equipment} equipment</span>
                        <span className="block">{s._count.jobs} jobs</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Equipment (${customer.equipment.length})`} bodyClassName={customer.equipment.length ? "p-0" : undefined}>
            {customer.equipment.length === 0 ? (
              <EmptyState icon={Cog} title="No equipment recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.equipment.map((e) => (
                  <li key={e.id}>
                    <Link href={`/equipment/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{e.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {EQUIPMENT_TYPE_LABELS[e.type]} · {e.site.name}
                          {e.serialNumber ? ` · Sr. ${e.serialNumber}` : ""}
                        </span>
                      </span>
                      <Badge tone={AMC_TONE[e.amcStatus]}>{AMC_STATUS_LABELS[e.amcStatus]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Service jobs (${customer.jobs.length})`} bodyClassName={customer.jobs.length ? "p-0" : undefined}>
            {customer.jobs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No service jobs yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--te-primary)]">{j.jobNumber}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {j.serviceType.name} · {j.site.name} · {formatDate(j.requestDate)}
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
              <LinkButton href={`/jobs/new?customerId=${customer.id}`} variant="primary" size="md">
                <ClipboardList className="h-4 w-4" /> New service job
              </LinkButton>
              <LinkButton href={`/sites?customerId=${customer.id}`} variant="outline" size="md">
                <MapPin className="h-4 w-4" /> Manage sites
              </LinkButton>
              <LinkButton href={`/equipment?customerId=${customer.id}`} variant="outline" size="md">
                <Cog className="h-4 w-4" /> Manage equipment
              </LinkButton>
              {customer.mobile && (
                <a href={`tel:${customer.mobile}`} className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Phone className="h-4 w-4" /> Call {customer.contactPerson ?? "contact"}
                </a>
              )}
              {customer.whatsapp && (
                <a href={`https://wa.me/${customer.whatsapp.replace(/\D/g, "").length === 10 ? `91${customer.whatsapp.replace(/\D/g, "")}` : customer.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="te-focus inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
            </div>
          </Card>

          <Card title={`Additional contacts (${customer.contacts.length})`} bodyClassName={customer.contacts.length ? "p-0" : undefined}>
            {customer.contacts.length === 0 ? (
              <EmptyState icon={Building2} title="No additional contacts" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {customer.contacts.map((c) => (
                  <li key={c.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[c.designation, c.department].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{[c.mobile, c.email].filter(Boolean).join(" · ")}</p>
                      </div>
                      {c.isPrimary && <Badge tone="primary">Primary</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Reports">
            <div className="space-y-3 text-sm">
              <ReportGroup icon={FileText} label="MOM" items={moms.map((m) => ({ id: m.id, label: m.momNumber, href: `/mom/${m.id}`, sub: formatDate(m.meetingDate) }))} />
              <ReportGroup icon={FileText} label="Daily reports" items={dailyReports.map((d) => ({ id: d.id, label: d.reportNumber, href: `/daily-reports/${d.id}`, sub: formatDate(d.reportDate) }))} />
              <ReportGroup icon={FileText} label="Final reports" items={finalReports.map((f) => ({ id: f.id, label: f.reportNumber, href: `/final-reports/${f.id}`, sub: formatDate(f.completionDate) }))} />
            </div>
          </Card>

          <Card title="Service history">
            <Timeline entries={timeline} />
          </Card>
        </div>
      </div>
    </>
  );
}

function ReportGroup({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ElementType;
  label: string;
  items: { id: string; label: string; href: string; sub: string }[];
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
        <Icon className="h-3.5 w-3.5" /> {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">None yet</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2">
              <Link href={i.href} className="truncate text-xs font-medium text-[var(--te-primary)] hover:underline">
                {i.label}
              </Link>
              <span className="shrink-0 text-[11px] text-slate-400">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

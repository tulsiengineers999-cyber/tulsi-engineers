"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Save, Eye, Code2, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Button, Field, Input, Textarea, Select, Alert, LoadingBlock, Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { api, ApiError } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[] | null;
  isSystem: boolean;
  status: "ACTIVE" | "INACTIVE";
}

interface WhatsappTemplate {
  id: string;
  code: string;
  name: string;
  language: string;
  bodyPreview: string | null;
  variables: string[] | null;
  isSystem: boolean;
  status: "ACTIVE" | "INACTIVE";
}

/** Sample values used only for the on-screen preview. */
const SAMPLE: Record<string, string> = {
  company_name: "TULSI ENGINEERS",
  company_tagline: "Manufacturer, Supplier, Repairer & Service Provider of Industrial Boilers, Heaters, Pollution Control Equipment & Accessories",
  company_address: "Plot No. 24, GIDC Industrial Estate, Odhav Road, Ahmedabad, Gujarat, 382415",
  company_phone: "079-2287XXXX / +91 98250 00000",
  company_email: "service@tulsiengineers.in",
  company_website: "www.tulsiengineers.com",
  contact_person: "Rakesh Patel",
  customer_name: "ABC Industries Pvt. Ltd.",
  user_name: "Demo Service Engineer",
  site_name: "Ahmedabad Plant",
  job_number: "TE/JOB/2026-27/0001",
  mom_number: "TE/MOM/2026-27/0001",
  report_number: "TE/DWR/2026-27/0002",
  document_number: "TE/MOM/2026-27/0001",
  document_type: "Minutes of Meeting",
  meeting_date: "12 Aug 2026",
  report_date: "17 Aug 2026",
  completion_date: "18 Aug 2026",
  confirmed_at: "18 Aug 2026, 06:20 pm",
  equipment_name: "2 TPH Steam Boiler",
  service_type: "Preventive Maintenance",
  planned_date: "20 Aug 2026",
  priority: "High",
  progress: "100",
  otp_code: "482913",
  expiry_minutes: "10",
  summary: "Annual preventive maintenance completed. Please review and confirm.",
  report_link: "https://service.tulsiengineers.com/report/example",
  reset_link: "https://service.tulsiengineers.com/reset-password?token=example",
};

function render(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => SAMPLE[key] ?? `[${key}]`);
}

export default function TemplatesPage() {
  const toast = useToast();
  const [tab, setTab] = useState("email");
  const [emails, setEmails] = useState<EmailTemplate[]>([]);
  const [whatsapps, setWhatsapps] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, w] = await Promise.all([
        api.list<EmailTemplate>("/api/email-templates"),
        api.list<WhatsappTemplate>("/api/whatsapp-templates"),
      ]);
      setEmails(e.items);
      setWhatsapps(w.items);
    } catch (err) {
      toast.error("Could not load templates", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Templates"
        description="The wording of every email and WhatsApp message the system sends."
        crumbs={[{ label: "Templates" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "email", label: "Email templates", count: emails.length },
          { key: "whatsapp", label: "WhatsApp templates", count: whatsapps.length },
        ]}
      />

      {loading ? (
        <LoadingBlock label="Loading templates…" />
      ) : tab === "email" ? (
        <EmailEditor templates={emails} onSaved={load} />
      ) : (
        <WhatsappEditor templates={whatsapps} onSaved={load} />
      )}
    </>
  );
}

function EmailEditor({ templates, onSaved }: { templates: EmailTemplate[]; onSaved: () => void }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const selected = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (selected) {
      setSubject(selected.subject);
      setBodyHtml(selected.bodyHtml);
      setStatus(selected.status);
    }
  }, [selected]);

  const insertVariable = (name: string) => {
    const el = bodyRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      setBodyHtml((b) => b + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = bodyHtml.slice(0, start) + token + bodyHtml.slice(end);
    setBodyHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.put(`/api/email-templates/${selected.id}`, { subject, bodyHtml, status });
      toast.success("Template saved", selected.name);
      onSaved();
    } catch (err) {
      toast.error("Could not save the template", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!templates.length) return <Alert tone="warning">No email templates found. Re-run the database seed to restore them.</Alert>;

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <Card title="Templates" bodyClassName="p-0">
        <ul className="divide-y divide-slate-100">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                  t.id === selectedId ? "bg-[var(--te-primary-light)]" : "hover:bg-slate-50"
                }`}
              >
                <Mail className={`h-4 w-4 shrink-0 ${t.id === selectedId ? "text-[var(--te-primary)]" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.id === selectedId ? "font-semibold text-[var(--te-primary)]" : "text-slate-700"}`}>
                    {t.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-slate-400">{t.code}</span>
                </span>
                {t.status === "INACTIVE" && <Badge tone="neutral">Off</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <Card
          title={selected.name}
          description={`Code: ${selected.code}`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setMode(mode === "edit" ? "preview" : "edit")}>
                {mode === "edit" ? <Eye className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
                {mode === "edit" ? "Preview" : "Edit HTML"}
              </Button>
              <Button size="sm" onClick={save} loading={busy}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field label="Subject" required>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
            </div>

            {selected.variables && selected.variables.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Available variables — click to insert
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="te-focus rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-600 hover:border-[var(--te-primary)] hover:text-[var(--te-primary)]"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "edit" ? (
              <Field label="Email body (HTML)">
                <Textarea
                  ref={bodyRef}
                  rows={20}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="font-mono text-xs"
                  spellCheck={false}
                />
              </Field>
            ) : (
              <div>
                <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Preview with sample values
                </p>
                <p className="mb-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-400">Subject: </span>
                  <span className="font-medium text-slate-800">{render(subject)}</span>
                </p>
                <div
                  className="overflow-x-auto rounded-lg border border-slate-200"
                  // Preview of an administrator-authored template, rendered with sample values.
                  dangerouslySetInnerHTML={{ __html: render(bodyHtml) }}
                />
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function WhatsappEditor({ templates, onSaved }: { templates: WhatsappTemplate[]; onSaved: () => void }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState({ name: "", language: "en", bodyPreview: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" });
  const [busy, setBusy] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (selected) {
      setValues({
        name: selected.name,
        language: selected.language,
        bodyPreview: selected.bodyPreview ?? "",
        status: selected.status,
      });
    }
  }, [selected]);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.put(`/api/whatsapp-templates/${selected.id}`, values);
      toast.success("Template saved", selected.code);
      onSaved();
    } catch (err) {
      toast.error("Could not save the template", err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!templates.length) return <Alert tone="warning">No WhatsApp templates found. Re-run the database seed to restore them.</Alert>;

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <Card title="Templates" bodyClassName="p-0">
        <ul className="divide-y divide-slate-100">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                  t.id === selectedId ? "bg-[var(--te-primary-light)]" : "hover:bg-slate-50"
                }`}
              >
                <MessageSquare className={`h-4 w-4 shrink-0 ${t.id === selectedId ? "text-[var(--te-primary)]" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.id === selectedId ? "font-semibold text-[var(--te-primary)]" : "text-slate-700"}`}>
                    {t.code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-slate-400">{t.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <div className="space-y-5">
          <Alert tone="info" title="The message text itself is approved by Meta, not here">
            WhatsApp only delivers template messages whose body has been approved in WhatsApp Manager. This screen maps
            our data onto that approved template: the <b>template name</b> must match exactly, and the preview below
            must mirror the approved copy so your team can see what the customer receives. Changing the wording here
            does not change what WhatsApp sends.
          </Alert>

          <Card
            title={selected.code.replace(/_/g, " ")}
            actions={
              <Button size="sm" onClick={save} loading={busy}>
                <Save className="h-4 w-4" /> Save
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Meta template name" required hint="must match WhatsApp Manager exactly">
                <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} className="font-mono" />
              </Field>
              <Field label="Language code">
                <Input value={values.language} onChange={(e) => setValues((v) => ({ ...v, language: e.target.value }))} placeholder="en" className="font-mono" />
              </Field>
              <Field label="Approved body (for reference)" className="sm:col-span-2">
                <Textarea
                  rows={4}
                  value={values.bodyPreview}
                  onChange={(e) => setValues((v) => ({ ...v, bodyPreview: e.target.value }))}
                  placeholder="Dear {{1}}, …"
                />
              </Field>
              <Field label="Status">
                <Select value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as "ACTIVE" | "INACTIVE" }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
            </div>

            {selected.variables && selected.variables.length > 0 && (
              <div className="mt-5">
                <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Parameter order sent to WhatsApp
                </p>
                <ol className="space-y-1 text-sm text-slate-600">
                  {selected.variables.map((v, i) => (
                    <li key={v} className="flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-100 font-mono text-[10px] text-slate-600">
                        {i + 1}
                      </span>
                      <code className="font-mono text-xs">{v}</code>
                      <span className="text-xs text-slate-400">→ {SAMPLE[v] ?? "—"}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-5">
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Preview</p>
              <div className="max-w-md rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                {values.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, i: string) => {
                  const key = selected.variables?.[Number(i) - 1];
                  return key ? (SAMPLE[key] ?? `[${key}]`) : `[${i}]`;
                }) || "No body recorded."}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Send, MessageSquare, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card, Button, Field, Input, Textarea, Checkbox, Select, Alert, LoadingBlock, Badge, SectionTitle,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { api, ApiError } from "@/lib/client-api";
import { whatsappNumberError } from "@/lib/validation/whatsapp";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_COMPANY, DEFAULT_THEME, type CompanyProfile } from "@/lib/company";
import { fiscalYearLabel } from "./fiscalYear";

type Json = Record<string, unknown>;

interface SettingsPayload {
  [group: string]: { key: string; value: unknown; label: string | null; isSecret: boolean }[];
}

interface Integrations {
  email: { driver: string; configured: boolean; fromEmail: string; host: string };
  whatsapp: { driver: string; provider: string; configured: boolean; configurationError: string | null; endpoint: string; lastFailure: string | null; phoneNumberIdMasked: string; instanceName: string; apiVersion: string };
  storage: { driver: string; bucket: string };
  pdf: { driver: string; chromiumAvailable: boolean };
  otp: { length: number; ttlMinutes: number; maxAttempts: number; maxResends: number };
}

const SEQUENCE_KEYS = [
  { key: "JOB", label: "Service Job" },
  { key: "SV", label: "Site Visit" },
  { key: "MOM", label: "Minutes of Meeting" },
  { key: "DWR", label: "Daily Work Report" },
  { key: "FSR", label: "Final Service Report" },
  { key: "CUST", label: "Customer" },
  { key: "SITE", label: "Site" },
  { key: "EQP", label: "Equipment" },
] as const;

const FISCAL_KEYS = new Set(["JOB", "SV", "MOM", "DWR", "FSR"]);

const REQUIRED_ENV = [
  { name: "DATABASE_URL", note: "Managed PostgreSQL connection string" },
  { name: "AUTH_SECRET", note: "Long random string used to sign sessions" },
  { name: "APP_URL", note: "Public HTTPS address, e.g. https://service.tulsiengineers.com" },
  { name: "OTP_PEPPER", note: "Long random string used to hash one-time passwords" },
  { name: "STORAGE_DRIVER / S3_*", note: "Object storage for photos, documents and PDFs" },
  { name: "MAIL_DRIVER / SMTP_*", note: "Set MAIL_DRIVER=SMTP with your provider's credentials" },
  { name: "WHATSAPP_DRIVER / META_* or WAPIO_*", note: "Set CLOUD_API with Meta or Wapio credentials" },
  { name: "CHROMIUM_PATH", note: "Only when the host does not ship a Chromium binary" },
];

export default function SettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);

  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [numbering, setNumbering] = useState<Record<string, { prefix: string; padding: number }>>({});
  const [files, setFiles] = useState({ maxUploadMb: 15, maxPhotosPerReport: 40 });
  const [rules, setRules] = useState<Json>({});
  const [otp, setOtp] = useState({ length: 6, ttlMinutes: 10, maxAttempts: 5, maxResends: 3, preferredChannel: "WHATSAPP" });
  const [pdf, setPdf] = useState({ showLogo: true, showSignature: true, showPhotos: true, photosPerRow: 2, pageSize: "A4", showTerms: true });

  const [testEmail, setTestEmail] = useState("");
  const [testWhatsapp, setTestWhatsapp] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testWhatsappError, setTestWhatsappError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, ints] = await Promise.all([
        api.get<SettingsPayload>("/api/settings"),
        api.get<Integrations>("/api/settings/integrations").catch(() => null),
      ]);
      const find = <T,>(key: string, fallback: T): T => {
        for (const list of Object.values(settings)) {
          const row = list.find((r) => r.key === key);
          if (row && row.value && typeof row.value === "object") return row.value as T;
        }
        return fallback;
      };
      setCompany({ ...DEFAULT_COMPANY, ...find<Partial<CompanyProfile>>("company.profile", {}) });
      setTheme({ ...DEFAULT_THEME, ...find<Partial<typeof DEFAULT_THEME>>("ui.theme", {}) });
      setNumbering(find("numbering.sequences", {}));
      setFiles((f) => ({ ...f, ...find("files.limits", {}) }));
      setRules(find<Json>("notifications.rules", {}));
      setOtp((o) => ({ ...o, ...find("otp.policy", {}) }));
      setPdf((p) => ({ ...p, ...find("pdf.options", {}) }));
      if (ints) setIntegrations(ints);
    } catch (err) {
      toast.error("Could not load settings", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key: string, value: unknown, label: string) => {
    setSaving(true);
    try {
      await api.put("/api/settings", { key, value });
      toast.success(`${label} saved`, "The change applies immediately across the application.");
    } catch (err) {
      toast.error(`Could not save ${label.toLowerCase()}`, err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (kind: "email" | "whatsapp") => {
    const to = kind === "email" ? testEmail : testWhatsapp;
    if (!to.trim()) {
      toast.warning("Enter a destination first");
      return;
    }
    if (kind === "whatsapp") {
      const numberError = whatsappNumberError(to);
      if (numberError) {
        setTestWhatsappError(numberError);
        return;
      }
      setTestWhatsappError(null);
    }
    setTesting(kind);
    try {
      const res = await api.post<{ delivered?: boolean; simulated?: boolean; error?: string }>(
        `/api/settings/test-${kind}`,
        { to },
      );
      if (res.delivered) toast.success("Test sent", `Check ${to}.`);
      else if (res.simulated)
        toast.warning(
          "Recorded but not sent",
          kind === "email"
            ? "MAIL_DRIVER is set to LOG. Set it to SMTP with valid credentials to send for real."
            : "WHATSAPP_DRIVER is set to LOG. Set it to CLOUD_API with valid credentials to send for real.",
        );
      else {
        console.error("[settings] WhatsApp test failed", { destination: to, error: res.error });
        toast.error("Test failed", res.error ?? "The message could not be sent.");
      }
    } catch (err) {
      console.error("[settings] WhatsApp test request failed", err);
      toast.error("Test failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setTesting(null);
    }
  };

  const nextNumberExample = useMemo(() => {
    const fy = fiscalYearLabel();
    return (key: string) => {
      const cfg = numbering[key] ?? { prefix: key, padding: 4 };
      const serial = "1".padStart(cfg.padding || 4, "0");
      return FISCAL_KEYS.has(key) ? `${cfg.prefix}/${fy}/${serial}` : `${cfg.prefix}-${serial}`;
    };
  }, [numbering]);

  if (loading) return <LoadingBlock label="Loading settings…" />;

  const setCompanyField = (k: keyof CompanyProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCompany((c) => ({ ...c, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        title="System Settings"
        description="Anything that may change in future is configured here rather than in the code."
        crumbs={[{ label: "System Settings" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "company", label: "Company profile" },
          { key: "branding", label: "Branding & theme" },
          { key: "numbering", label: "Document numbering" },
          { key: "files", label: "File limits" },
          { key: "notifications", label: "Notifications" },
          { key: "otp", label: "OTP policy" },
          { key: "pdf", label: "PDF options" },
          { key: "integrations", label: "Integrations" },
        ]}
      />

      {tab === "company" && (
        <Card
          title="Company profile"
          description="Used on every PDF, email header and the sign-in screen."
          actions={
            <Button onClick={() => save("company.profile", company, "Company profile")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" required className="sm:col-span-2">
                <Input value={company.name} onChange={setCompanyField("name")} />
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <Textarea rows={2} value={company.tagline} onChange={setCompanyField("tagline")} />
              </Field>
            </div>

            <div>
              <SectionTitle>Registered address</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Address line 1"><Input value={company.addressLine1} onChange={setCompanyField("addressLine1")} /></Field>
                <Field label="Address line 2"><Input value={company.addressLine2} onChange={setCompanyField("addressLine2")} /></Field>
                <Field label="City"><Input value={company.city} onChange={setCompanyField("city")} /></Field>
                <Field label="State"><Input value={company.state} onChange={setCompanyField("state")} /></Field>
                <Field label="PIN code"><Input value={company.pinCode} onChange={setCompanyField("pinCode")} inputMode="numeric" maxLength={6} /></Field>
                <Field label="Country"><Input value={company.country} onChange={setCompanyField("country")} /></Field>
              </div>
            </div>

            <div>
              <SectionTitle>Contact & statutory</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone"><Input value={company.phone} onChange={setCompanyField("phone")} /></Field>
                <Field label="Mobile"><Input value={company.mobile} onChange={setCompanyField("mobile")} /></Field>
                <Field label="Email"><Input type="email" value={company.email} onChange={setCompanyField("email")} /></Field>
                <Field label="Website"><Input value={company.website} onChange={setCompanyField("website")} /></Field>
                <Field label="GSTIN"><Input value={company.gstNumber} onChange={setCompanyField("gstNumber")} className="uppercase" maxLength={15} /></Field>
              </div>
            </div>

            <div>
              <SectionTitle>PDF branding</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Logo URL" hint="square PNG works best">
                  <Input value={company.logoUrl} onChange={setCompanyField("logoUrl")} placeholder="https://…/logo.png" />
                </Field>
                <Field label="Signature image URL">
                  <Input value={company.signatureUrl} onChange={setCompanyField("signatureUrl")} placeholder="https://…/signature.png" />
                </Field>
                <Field label="PDF footer note" className="sm:col-span-2">
                  <Textarea rows={2} value={company.pdfFooterNote} onChange={setCompanyField("pdfFooterNote")} />
                </Field>
                <Field label="Terms & conditions printed on reports" className="sm:col-span-2">
                  <Textarea rows={4} value={company.pdfTerms} onChange={setCompanyField("pdfTerms")} />
                </Field>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "branding" && (
        <Card
          title="Branding & theme"
          description="Colours apply across the application and PDF headers without a rebuild."
          actions={
            <Button onClick={() => save("ui.theme", theme, "Theme")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-3">
            {(
              [
                { key: "primary", label: "Primary", help: "Headings, links and primary buttons" },
                { key: "accent", label: "Accent", help: "Active navigation and call-to-action buttons" },
                { key: "sidebar", label: "Sidebar", help: "Background of the left navigation" },
              ] as const
            ).map((c) => (
              <Field key={c.key} label={c.label} hint={c.help}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme[c.key]}
                    onChange={(e) => setTheme((t) => ({ ...t, [c.key]: e.target.value }))}
                    aria-label={`${c.label} colour`}
                    className="te-focus h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                  />
                  <Input
                    value={theme[c.key]}
                    onChange={(e) => setTheme((t) => ({ ...t, [c.key]: e.target.value }))}
                    className="font-mono uppercase"
                  />
                </div>
              </Field>
            ))}
          </div>

          <div className="mt-5">
            <SectionTitle>Preview</SectionTitle>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-4">
              <span className="rounded px-4 py-2 text-sm font-semibold text-white" style={{ background: theme.sidebar }}>
                Sidebar
              </span>
              <span className="rounded px-4 py-2 text-sm font-semibold text-white" style={{ background: theme.primary }}>
                Primary button
              </span>
              <span className="rounded px-4 py-2 text-sm font-semibold text-white" style={{ background: theme.accent }}>
                Accent button
              </span>
              <span className="text-sm font-semibold" style={{ color: theme.primary }}>
                Linked text
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Reload the page after saving to see the new colours everywhere.</p>
          </div>
        </Card>
      )}

      {tab === "numbering" && (
        <Card
          title="Document numbering"
          description="Job, MOM and report numbers reset each financial year (1 April – 31 March)."
          actions={
            <Button onClick={() => save("numbering.sequences", numbering, "Document numbering")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="space-y-3">
            {SEQUENCE_KEYS.map((s) => {
              const cfg = numbering[s.key] ?? { prefix: s.key, padding: 4 };
              return (
                <div key={s.key} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_1fr_2fr]">
                  <p className="text-sm font-medium text-slate-700">{s.label}</p>
                  <Field label="Prefix">
                    <Input
                      value={cfg.prefix}
                      onChange={(e) => setNumbering((n) => ({ ...n, [s.key]: { ...cfg, prefix: e.target.value } }))}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Digits">
                    <Input
                      type="number"
                      min={2}
                      max={8}
                      value={cfg.padding}
                      onChange={(e) => setNumbering((n) => ({ ...n, [s.key]: { ...cfg, padding: Number(e.target.value) } }))}
                    />
                  </Field>
                  <p className="pb-2 font-mono text-xs text-slate-500">
                    Next: <span className="font-semibold text-slate-800">{nextNumberExample(s.key)}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <Alert tone="info" className="mt-4">
            Changing a prefix affects only numbers issued from now on. Existing documents keep the number they were
            given.
          </Alert>
        </Card>
      )}

      {tab === "files" && (
        <Card
          title="File limits"
          description="Applies to photo and document uploads from both the office and the field."
          actions={
            <Button onClick={() => save("files.limits", files, "File limits")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Maximum upload size" hint="megabytes per file">
              <Input
                type="number"
                min={1}
                max={100}
                value={files.maxUploadMb}
                onChange={(e) => setFiles((f) => ({ ...f, maxUploadMb: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Maximum photos per report">
              <Input
                type="number"
                min={1}
                max={200}
                value={files.maxPhotosPerReport}
                onChange={(e) => setFiles((f) => ({ ...f, maxPhotosPerReport: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <Alert tone="warning" className="mt-4" title="Server limit applies too">
            The upload size is also capped by <code>MAX_UPLOAD_MB</code> in the environment configuration. Raise both if
            you need larger files.
          </Alert>
        </Card>
      )}

      {tab === "notifications" && (
        <Card
          title="Notification rules"
          description="Who gets told, and when."
          actions={
            <Button onClick={() => save("notifications.rules", rules, "Notification rules")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["newJob", "A new service job is created"],
                ["jobAssigned", "A job is assigned to an engineer or technician"],
                ["overdueJobs", "A job passes its target completion date"],
                ["momPending", "A MOM is still in draft"],
                ["confirmationPending", "A client has not confirmed a report"],
                ["dailyReportPending", "A daily work report has not been submitted"],
                ["reportConfirmed", "A client confirms a report"],
                ["jobCompleted", "A job is marked completed"],
              ] as const
            ).map(([key, label]) => (
              <Checkbox
                key={key}
                label={label}
                checked={Boolean(rules[key])}
                onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Remind before a planned visit" hint="days">
              <Input
                type="number"
                min={0}
                max={30}
                value={Number(rules.visitUpcomingDays ?? 2)}
                onChange={(e) => setRules((r) => ({ ...r, visitUpcomingDays: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Warn before a target date" hint="days">
              <Input
                type="number"
                min={0}
                max={30}
                value={Number(rules.targetDateApproachingDays ?? 3)}
                onChange={(e) => setRules((r) => ({ ...r, targetDateApproachingDays: Number(e.target.value) }))}
              />
            </Field>
          </div>
        </Card>
      )}

      {tab === "otp" && (
        <Card
          title="OTP policy"
          description="Controls the one-time password a client enters to confirm a report."
          actions={
            <Button onClick={() => save("otp.policy", otp, "OTP policy")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code length" hint="digits">
              <Input type="number" min={4} max={8} value={otp.length} onChange={(e) => setOtp((o) => ({ ...o, length: Number(e.target.value) }))} />
            </Field>
            <Field label="Validity" hint="minutes">
              <Input type="number" min={1} max={60} value={otp.ttlMinutes} onChange={(e) => setOtp((o) => ({ ...o, ttlMinutes: Number(e.target.value) }))} />
            </Field>
            <Field label="Maximum wrong attempts">
              <Input type="number" min={1} max={10} value={otp.maxAttempts} onChange={(e) => setOtp((o) => ({ ...o, maxAttempts: Number(e.target.value) }))} />
            </Field>
            <Field label="Maximum resends">
              <Input type="number" min={0} max={10} value={otp.maxResends} onChange={(e) => setOtp((o) => ({ ...o, maxResends: Number(e.target.value) }))} />
            </Field>
            <Field label="Preferred channel">
              <Select value={otp.preferredChannel} onChange={(e) => setOtp((o) => ({ ...o, preferredChannel: e.target.value }))}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </Select>
            </Field>
          </div>
          <Alert tone="info" className="mt-4" title="These values are enforced by the environment configuration">
            The running server reads OTP_LENGTH, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS and OTP_MAX_RESENDS from its
            environment. Keep the two in step, or set the environment variables from these values at deployment time.
            The one-time password itself is never stored — only a peppered hash of it.
          </Alert>
        </Card>
      )}

      {tab === "pdf" && (
        <Card
          title="PDF options"
          description="How generated documents are laid out."
          actions={
            <Button onClick={() => save("pdf.options", pdf, "PDF options")} loading={saving}>
              <Save className="h-4 w-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox label="Show the company logo" checked={pdf.showLogo} onChange={(e) => setPdf((p) => ({ ...p, showLogo: e.target.checked }))} />
            <Checkbox label="Show signature blocks" checked={pdf.showSignature} onChange={(e) => setPdf((p) => ({ ...p, showSignature: e.target.checked }))} />
            <Checkbox label="Include photographs" checked={pdf.showPhotos} onChange={(e) => setPdf((p) => ({ ...p, showPhotos: e.target.checked }))} />
            <Checkbox label="Print terms & conditions" checked={pdf.showTerms} onChange={(e) => setPdf((p) => ({ ...p, showTerms: e.target.checked }))} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Photographs per row">
              <Input type="number" min={1} max={4} value={pdf.photosPerRow} onChange={(e) => setPdf((p) => ({ ...p, photosPerRow: Number(e.target.value) }))} />
            </Field>
            <Field label="Page size">
              <Select value={pdf.pageSize} onChange={(e) => setPdf((p) => ({ ...p, pageSize: e.target.value }))}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </Select>
            </Field>
          </div>
        </Card>
      )}

      {tab === "integrations" && integrations && (
        <div className="space-y-5">
          <Card title="Integration status" description="Read-only. Credentials live in environment variables and are never shown here.">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatusTile
                title="Email (SMTP)"
                ok={integrations.email.configured}
                lines={[
                  `Driver: ${integrations.email.driver}`,
                  `Host: ${integrations.email.host}`,
                  `From: ${integrations.email.fromEmail}`,
                ]}
                warning={!integrations.email.configured ? "Messages are recorded in Email History but not transmitted." : undefined}
              />
              <StatusTile
                title={`WhatsApp (${integrations.whatsapp.provider})`}
                ok={integrations.whatsapp.configured && !integrations.whatsapp.lastFailure}
                lines={[
                  `Driver: ${integrations.whatsapp.driver}`,
                  `Provider: ${integrations.whatsapp.provider}`,
                  `Endpoint: ${integrations.whatsapp.endpoint}`,
                  `API version: ${integrations.whatsapp.apiVersion}`,
                  integrations.whatsapp.provider === "WAPIO"
                    ? `Instance: ${integrations.whatsapp.instanceName || "not set"}`
                    : `Phone number ID: ${integrations.whatsapp.phoneNumberIdMasked || "not set"}`,
                ]}
                warning={integrations.whatsapp.configurationError ?? integrations.whatsapp.lastFailure ?? (!integrations.whatsapp.configured ? "Messages are recorded in WhatsApp History but not transmitted." : undefined)}
              />
              <StatusTile
                title="File storage"
                ok={integrations.storage.driver === "S3" || integrations.storage.driver === "DATABASE"}
                lines={[
                  `Driver: ${integrations.storage.driver}`,
                  integrations.storage.driver === "S3"
                    ? `Bucket: ${integrations.storage.bucket}`
                    : integrations.storage.driver === "DATABASE"
                      ? "PostgreSQL database"
                      : "Local disk",
                ]}
                warning={
                  integrations.storage.driver !== "S3" && integrations.storage.driver !== "DATABASE"
                    ? "Local disk is fine for a single server but is lost on redeploy in most cloud hosts. Use S3-compatible storage in production."
                    : undefined
                }
              />
              <StatusTile
                title="PDF generation"
                ok={integrations.pdf.chromiumAvailable}
                lines={[`Driver: ${integrations.pdf.driver}`]}
                warning={
                  !integrations.pdf.chromiumAvailable
                    ? "Documents will be produced as printable HTML instead of PDF."
                    : undefined
                }
              />
            </div>
          </Card>

          <Card title="Send a test message">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Field label="Test email address">
                  <div className="flex gap-2">
                    <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@tulsiengineers.com" />
                    <Button variant="outline" onClick={() => sendTest("email")} loading={testing === "email"}>
                      <Send className="h-4 w-4" /> Send
                    </Button>
                  </div>
                </Field>
              </div>
              <div>
                <Field label="Test WhatsApp number">
                  <div className="flex gap-2">
                    <Input
                      value={testWhatsapp}
                      onChange={(e) => {
                        setTestWhatsapp(e.target.value);
                        setTestWhatsappError(whatsappNumberError(e.target.value));
                      }}
                      placeholder="98250 00000"
                      inputMode="tel"
                      maxLength={16}
                      aria-invalid={Boolean(testWhatsappError)}
                    />
                    {testWhatsappError && <p className="mt-1 text-xs text-red-600">{testWhatsappError}</p>}
                    {!testWhatsappError && testWhatsapp && <p className="mt-1 text-xs text-slate-500">Valid WhatsApp number</p>}
                    <Button variant="outline" onClick={() => sendTest("whatsapp")} loading={testing === "whatsapp"}>
                      <MessageSquare className="h-4 w-4" /> Send
                    </Button>
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Environment variables required in production" description="Set these on your hosting platform. Values are never displayed or stored in the database.">
            <ul className="divide-y divide-slate-100">
              {REQUIRED_ENV.map((v) => (
                <li key={v.name} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">{v.name}</code>
                  <span className="text-xs text-slate-500">{v.note}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function StatusTile({
  title,
  ok,
  lines,
  warning,
}: {
  title: string;
  ok: boolean;
  lines: string[];
  warning?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <Badge tone={ok ? "success" : "warning"}>
          {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {ok ? "Live" : warning ? "Needs attention" : "Simulated"}
        </Badge>
      </div>
      <ul className="space-y-0.5 text-xs text-slate-500">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {warning && (
        <p className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
        </p>
      )}
    </div>
  );
}

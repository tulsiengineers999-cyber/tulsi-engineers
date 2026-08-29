/** Default communication templates. Editable at runtime from Admin → Templates. */

export interface EmailTemplateSeed {
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
}

const wrap = (title: string, inner: string) => `
<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6f8;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e3e8ee">
    <div style="background:#0F4C81;padding:20px 24px;color:#ffffff">
      <div style="font-size:20px;font-weight:700;letter-spacing:.5px">{{company_name}}</div>
      <div style="font-size:11px;opacity:.85;margin-top:4px">{{company_tagline}}</div>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0F4C81">${title}</h2>
      ${inner}
    </div>
    <div style="background:#f8fafc;padding:16px 24px;font-size:11px;color:#64748b;border-top:1px solid #e3e8ee">
      {{company_name}} &nbsp;|&nbsp; {{company_address}}<br/>
      {{company_phone}} &nbsp;|&nbsp; {{company_email}} &nbsp;|&nbsp; {{company_website}}
    </div>
  </div>
</div>`;

const button = (label: string) =>
  `<p style="margin:24px 0"><a href="{{report_link}}" style="background:#F26522;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">${label}</a></p>
   <p style="font-size:12px;color:#64748b">If the button does not work, copy this link into your browser:<br/><span style="word-break:break-all">{{report_link}}</span></p>`;

const COMMON = [
  "company_name", "company_tagline", "company_address", "company_phone",
  "company_email", "company_website", "customer_name", "contact_person",
];

export const EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    code: "MOM_SENT",
    name: "MOM Sent to Client",
    subject: "Minutes of Meeting {{mom_number}} — {{site_name}}",
    bodyHtml: wrap(
      "Minutes of Meeting",
      `<p>Dear {{contact_person}},</p>
       <p>Please find attached the Minutes of Meeting for our recent site visit at <b>{{site_name}}</b>.</p>
       <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
         <tr><td style="padding:6px 0;color:#64748b;width:150px">MOM Number</td><td style="padding:6px 0"><b>{{mom_number}}</b></td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Job Number</td><td style="padding:6px 0">{{job_number}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Meeting Date</td><td style="padding:6px 0">{{meeting_date}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Equipment</td><td style="padding:6px 0">{{equipment_name}}</td></tr>
       </table>
       <p>{{summary}}</p>
       <p>Kindly review the document online and confirm it using the secure link below. A one-time password will be sent to your registered number for verification.</p>
       ${button("View &amp; Confirm MOM")}`,
    ),
    variables: [...COMMON, "mom_number", "job_number", "meeting_date", "site_name", "equipment_name", "summary", "report_link"],
  },
  {
    code: "DAILY_REPORT_SENT",
    name: "Daily Work Report Sent",
    subject: "Daily Service Report {{report_number}} — {{site_name}}",
    bodyHtml: wrap(
      "Daily Service Report",
      `<p>Dear {{contact_person}},</p>
       <p>Please find the daily service report for work carried out at <b>{{site_name}}</b> on {{report_date}}.</p>
       <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
         <tr><td style="padding:6px 0;color:#64748b;width:150px">Report Number</td><td style="padding:6px 0"><b>{{report_number}}</b></td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Job Number</td><td style="padding:6px 0">{{job_number}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0">{{report_date}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Progress</td><td style="padding:6px 0">{{progress}}%</td></tr>
       </table>
       <p>{{summary}}</p>
       ${button("View &amp; Confirm Report")}`,
    ),
    variables: [...COMMON, "report_number", "job_number", "report_date", "site_name", "progress", "summary", "report_link"],
  },
  {
    code: "FINAL_REPORT_SENT",
    name: "Final Service Report Sent",
    subject: "Service Completion Report {{report_number}} — {{site_name}}",
    bodyHtml: wrap(
      "Final Service Report",
      `<p>Dear {{contact_person}},</p>
       <p>We are pleased to inform you that the service work at <b>{{site_name}}</b> has been completed.</p>
       <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
         <tr><td style="padding:6px 0;color:#64748b;width:150px">Report Number</td><td style="padding:6px 0"><b>{{report_number}}</b></td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Job Number</td><td style="padding:6px 0">{{job_number}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Equipment</td><td style="padding:6px 0">{{equipment_name}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Completion Date</td><td style="padding:6px 0">{{completion_date}}</td></tr>
       </table>
       <p>{{summary}}</p>
       ${button("View &amp; Confirm Completion")}`,
    ),
    variables: [...COMMON, "report_number", "job_number", "site_name", "equipment_name", "completion_date", "summary", "report_link"],
  },
  {
    code: "CONFIRMATION_REQUEST",
    name: "Client Confirmation Request",
    subject: "Action required: confirm {{document_type}} {{document_number}}",
    bodyHtml: wrap(
      "Confirmation Required",
      `<p>Dear {{contact_person}},</p>
       <p>This is a reminder that <b>{{document_type}} {{document_number}}</b> is awaiting your confirmation.</p>
       ${button("Confirm Now")}`,
    ),
    variables: [...COMMON, "document_type", "document_number", "report_link"],
  },
  {
    code: "REPORT_CONFIRMED",
    name: "Report Confirmed Acknowledgement",
    subject: "Thank you — {{document_type}} {{document_number}} confirmed",
    bodyHtml: wrap(
      "Confirmation Received",
      `<p>Dear {{contact_person}},</p>
       <p>We have received your confirmation for <b>{{document_type}} {{document_number}}</b> on {{confirmed_at}}.</p>
       <p>A copy of the confirmed document is attached for your records. Thank you for your continued association with {{company_name}}.</p>`,
    ),
    variables: [...COMMON, "document_type", "document_number", "confirmed_at"],
  },
  {
    code: "REPORT_RESENT",
    name: "Report Resent",
    subject: "Reminder: {{document_type}} {{document_number}}",
    bodyHtml: wrap(
      "Document Resent",
      `<p>Dear {{contact_person}},</p>
       <p>As requested, we are resending <b>{{document_type}} {{document_number}}</b>.</p>
       ${button("Open Document")}`,
    ),
    variables: [...COMMON, "document_type", "document_number", "report_link"],
  },
  {
    code: "OTP_CODE",
    name: "OTP Verification Code",
    subject: "Your verification code: {{otp_code}}",
    bodyHtml: wrap(
      "Verification Code",
      `<p>Dear {{contact_person}},</p>
       <p>Use the code below to confirm <b>{{document_number}}</b>. It is valid for {{expiry_minutes}} minutes.</p>
       <p style="font-size:30px;letter-spacing:8px;font-weight:700;color:#0F4C81;margin:20px 0">{{otp_code}}</p>
       <p style="font-size:12px;color:#64748b">If you did not request this code, please ignore this email.</p>`,
    ),
    variables: [...COMMON, "otp_code", "document_number", "expiry_minutes"],
  },
  {
    code: "PASSWORD_RESET",
    name: "Password Reset",
    subject: "Reset your {{company_name}} password",
    bodyHtml: wrap(
      "Password Reset",
      `<p>Hello {{user_name}},</p>
       <p>A password reset was requested for your account. This link expires in {{expiry_minutes}} minutes.</p>
       <p style="margin:24px 0"><a href="{{reset_link}}" style="background:#0F4C81;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">Reset Password</a></p>
       <p style="font-size:12px;color:#64748b">If you did not request this, no action is needed.</p>`,
    ),
    variables: ["company_name", "company_tagline", "company_address", "company_phone", "company_email", "company_website", "user_name", "reset_link", "expiry_minutes"],
  },
  {
    code: "JOB_ASSIGNED",
    name: "Job Assigned to Engineer",
    subject: "New job assigned: {{job_number}}",
    bodyHtml: wrap(
      "Job Assignment",
      `<p>Hello {{user_name}},</p>
       <p>You have been assigned job <b>{{job_number}}</b> for {{customer_name}} at {{site_name}}.</p>
       <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
         <tr><td style="padding:6px 0;color:#64748b;width:150px">Service Type</td><td style="padding:6px 0">{{service_type}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Planned Visit</td><td style="padding:6px 0">{{planned_date}}</td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Priority</td><td style="padding:6px 0">{{priority}}</td></tr>
       </table>`,
    ),
    variables: [...COMMON, "user_name", "job_number", "site_name", "service_type", "planned_date", "priority"],
  },
];

export interface WhatsappTemplateSeed {
  code: string;
  name: string;
  language: string;
  bodyPreview: string;
  variables: string[];
}

/**
 * `name` must match the template approved in WhatsApp Manager.
 * `bodyPreview` mirrors the approved body so admins can see what will be sent;
 * WhatsApp itself renders the approved copy, not this string.
 */
export const WHATSAPP_TEMPLATES: WhatsappTemplateSeed[] = [
  {
    code: "MOM_NOTIFICATION",
    name: "te_mom_notification",
    language: "en",
    bodyPreview:
      "Dear {{1}}, Minutes of Meeting {{2}} for {{3}} is ready. View and confirm: {{4}} — TULSI ENGINEERS",
    variables: ["contact_person", "mom_number", "site_name", "report_link"],
  },
  {
    code: "MOM_CONFIRMATION",
    name: "te_mom_confirmation",
    language: "en",
    bodyPreview: "Thank you {{1}}. MOM {{2}} was confirmed on {{3}}. — TULSI ENGINEERS",
    variables: ["contact_person", "mom_number", "confirmed_at"],
  },
  {
    code: "DAILY_REPORT",
    name: "te_daily_report",
    language: "en",
    bodyPreview:
      "Dear {{1}}, Daily Service Report {{2}} dated {{3}} for {{4}} is ready. View and confirm: {{5}} — TULSI ENGINEERS",
    variables: ["contact_person", "report_number", "report_date", "site_name", "report_link"],
  },
  {
    code: "DAILY_REPORT_CONFIRMATION",
    name: "te_daily_report_confirmation",
    language: "en",
    bodyPreview: "Thank you {{1}}. Daily Report {{2}} was confirmed on {{3}}. — TULSI ENGINEERS",
    variables: ["contact_person", "report_number", "confirmed_at"],
  },
  {
    code: "FINAL_REPORT",
    name: "te_final_service_report",
    language: "en",
    bodyPreview:
      "Dear {{1}}, Service work at {{2}} is complete. Final Service Report {{3}}: {{4}} — TULSI ENGINEERS",
    variables: ["contact_person", "site_name", "report_number", "report_link"],
  },
  {
    code: "CLIENT_CONFIRMATION",
    name: "te_client_confirmation",
    language: "en",
    bodyPreview: "Dear {{1}}, please confirm {{2}} {{3}}: {{4}} — TULSI ENGINEERS",
    variables: ["contact_person", "document_type", "document_number", "report_link"],
  },
  {
    code: "REPORT_RESEND",
    name: "te_report_resend",
    language: "en",
    bodyPreview: "Dear {{1}}, resending {{2}} {{3}}: {{4}} — TULSI ENGINEERS",
    variables: ["contact_person", "document_type", "document_number", "report_link"],
  },
  {
    code: "OTP",
    name: "site_vite_confirmation_code",
    language: "en",
    bodyPreview: "{{1}} is your TULSI ENGINEERS verification code. It expires in {{2}} minutes.",
    variables: ["otp_code", "expiry_minutes"],
  },
];

/** Replaces {{var}} placeholders. Unknown placeholders resolve to "". */
export function renderTemplate(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

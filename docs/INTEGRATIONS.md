# Integrations

Every credential in this application lives in an environment variable, is read
only on the server, and is never returned to the browser, written to a log
record, or included in a backup export.

Admin → System Settings → Integrations shows whether each integration is **Live**
or **Simulated**, and names the variables it needs — never their values.

---

## Simulated mode

When `MAIL_DRIVER=LOG` or `WHATSAPP_DRIVER=LOG`, messages are written to Email
History and WhatsApp History exactly as they would be sent, but nothing leaves
the server. The row is marked **Simulated** in the interface with the reason.

This exists so the whole workflow — including OTP confirmation — can be
exercised before credentials are available, and so a staging environment can be
used without messaging real customers.

---

## Email (SMTP)

```
MAIL_DRIVER="SMTP"
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"            # use false with port 587
SMTP_USER="service@tulsiengineers.in"
SMTP_PASSWORD="<Hostinger mailbox password>"
MAIL_FROM_NAME="TULSI ENGINEERS"
MAIL_FROM_EMAIL="service@tulsiengineers.in"
MAIL_REPLY_TO="service@tulsiengineers.in"
```

Create the mailbox in Hostinger first. Use the complete mailbox address as
`SMTP_USER`, and make `MAIL_FROM_EMAIL` the same address (or another mailbox
allowed by the domain). Hostinger supports SMTP over SSL on port `465` and
STARTTLS on port `587`. Add these variables to the hosting provider's server
environment, not to Git.

Set up SPF, DKIM and DMARC on the sending domain or reports will land in spam.

Templates are editable at Admin → Templates → Email templates, with a variable
palette and a live preview. Nine templates ship with the system:
`MOM_SENT`, `DAILY_REPORT_SENT`, `FINAL_REPORT_SENT`, `CONFIRMATION_REQUEST`,
`REPORT_CONFIRMED`, `REPORT_RESENT`, `OTP_CODE`, `PASSWORD_RESET`, `JOB_ASSIGNED`.

Test from Admin → System Settings → Integrations → Send test email.

---

## WhatsApp Business Cloud API

### What Meta requires before you can send

1. A **Meta Business account** that has completed business verification.
2. A **WhatsApp Business Account (WABA)** inside it.
3. A **phone number** registered to the WABA. It cannot be in use on the
   consumer WhatsApp or WhatsApp Business app.
4. **Approved message templates.** Outside a 24-hour customer-initiated window —
   which is always the case here, because we message first — WhatsApp only
   delivers pre-approved templates.
5. A **System User permanent access token** with `whatsapp_business_messaging`
   and `whatsapp_business_management`. A 24-hour test token will expire and
   silently break sending.

### Configuration

```
WHATSAPP_DRIVER="CLOUD_API"
WHATSAPP_API_VERSION="v25.0"
WHATSAPP_PHONE_NUMBER_ID="…"          # WhatsApp Manager → API Setup
WHATSAPP_BUSINESS_ACCOUNT_ID="…"
WHATSAPP_ACCESS_TOKEN="…"             # System User permanent token
WHATSAPP_DEFAULT_LANGUAGE="en_US"
```

### Templates to create in WhatsApp Manager

| Name | Body to submit for approval |
|---|---|
| `te_mom_notification` | Dear {{1}}, Minutes of Meeting {{2}} for {{3}} is ready. View and confirm: {{4}} — TULSI ENGINEERS |
| `te_mom_confirmation` | Thank you {{1}}. MOM {{2}} was confirmed on {{3}}. — TULSI ENGINEERS |
| `te_daily_report` | Dear {{1}}, Daily Service Report {{2}} dated {{3}} for {{4}} is ready. View and confirm: {{5}} — TULSI ENGINEERS |
| `te_daily_report_confirmation` | Thank you {{1}}. Daily Report {{2}} was confirmed on {{3}}. — TULSI ENGINEERS |
| `te_final_service_report` | Dear {{1}}, Service work at {{2}} is complete. Final Service Report {{3}}: {{4}} — TULSI ENGINEERS |
| `te_client_confirmation` | Dear {{1}}, please confirm {{2}} {{3}}: {{4}} — TULSI ENGINEERS |
| `te_report_resend` | Dear {{1}}, resending {{2}} {{3}}: {{4}} — TULSI ENGINEERS |
| `site_vite_confirmation_code` | {{1}} is your TULSI ENGINEERS verification code. It expires in {{2}} minutes. |

For `site_vite_confirmation_code`, choose category **Authentication**. Meta applies
stricter rules to authentication templates and will reject an OTP body submitted
as Utility.

Approval usually takes minutes to a few hours. Rejections are almost always
about promotional wording or a missing variable example — supply a realistic
sample for each `{{n}}` when submitting.

### How the mapping works

The application never invents message text. Admin → Templates → WhatsApp
templates records, for each of our internal codes:

- the **Meta template name** to call,
- the **language code**,
- the **order of the variables** we substitute into `{{1}}`, `{{2}}`, …,
- a copy of the approved body, purely so your team can see what the customer receives.

Editing the body preview here changes what your staff see, not what WhatsApp
sends. To change the wording the customer receives, edit and resubmit the
template in WhatsApp Manager.

### Costs

Utility conversations are charged per 24-hour conversation window, and
authentication conversations separately. Indian rates are among the lowest
Meta charges, but budget for them: a service business sending a MOM, two daily
reports and a final report per job opens up to four conversation windows.
### Using a reseller instead

Interakt, AiSensy, Gupshup, Wati and similar providers wrap the same Cloud API
with easier onboarding. To switch, replace the `fetch` call in
`src/lib/services/whatsapp.ts` with the provider's endpoint and payload shape —
the rest of the application, including logging and OTP, is unchanged, because
everything goes through `sendWhatsappTemplate()`.

### Wapio Developer API

Wapio can be used instead of Meta Cloud API when the connected WhatsApp
instance is managed by Wapio. Create a developer API key in Wapio → Settings →
Developers, then configure the local or hosting environment with:

```
WHATSAPP_DRIVER="CLOUD_API"
WHATSAPP_PROVIDER="WAPIO"
WAPIO_ENDPOINT="https://app.wapvio.com/api/v1/send"
WAPIO_INSTANCE_NAME="Tulsi Engineers"
WAPIO_API_KEY="sk_live_…"
```

The Wapio key is sent only as a server-side Bearer credential. Never commit it
to Git or place it in a client component. Wapio sends a text message containing
the rendered template preview through `POST https://app.wapvio.com/api/v1/send`
identifies the connected WAPIO session.

---

## One-time passwords

```
OTP_LENGTH="6"
OTP_TTL_MINUTES="10"


2. Only `HMAC-SHA256(pepper, destination + ":" + code)` is stored. The plain
   code exists in memory long enough to be sent, and nowhere else.
3. Requesting a new code retires any live code for the same document and destination.
4. Verification is constant-time and counts attempts; the row is consumed on success.
5. A destination is limited to 5 codes in any 15-minute window.
6. Expiry, wrong-code and too-many-attempts all produce a clear message for the
   client without revealing whether the code ever existed.

In development, the API returns the code in a `devCode` field so the flow can be
tested without a real WhatsApp number. `NODE_ENV=production` removes it.

---

## Secure client report links

```
CLIENT_LINK_TTL_DAYS="30"
```

A link looks like `https://…/report/<prefix>.<token>`.

- `prefix` is a random public lookup id, safe to appear in a log.
- `token` is 24 random bytes; only its SHA-256 hash is stored.
- Comparison is constant-time.
- Links expire, can be revoked, and are revoked automatically when the document
  is revised to a new version.
- A link grants access only to that document and to files belonging to the same
  customer — never to the admin application, and never to another customer's files.
- Every view is counted, with first and last view timestamps.

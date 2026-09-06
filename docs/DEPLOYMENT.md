# Deployment

Target stack: **Next.js on Vercel + PostgreSQL on Neon or Supabase + S3-compatible object storage.**
Everything below also works on a VPS with Docker; the differences are noted where they matter.

---

## 1 · Provision the database

### Neon
1. Create a project at neon.tech, region **AWS ap-south-1 (Mumbai)** for the lowest latency from Gujarat.
2. Copy the **pooled** connection string — it ends in `-pooler`.
3. Confirm point-in-time recovery is enabled and note the retention window.

### Supabase
1. Create a project, region **South Asia (Mumbai)**.
2. Settings → Database → Connection string → **Transaction pooler** (port 6543).
3. Append `?pgbouncer=true&connection_limit=1` for serverless.

Either way you need two values:

```
DATABASE_URL="postgresql://…"            # pooled — used by the running app
DIRECT_URL="postgresql://…"              # direct — used by migrations only
```

If you use `DIRECT_URL`, add it to `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 2 · Provision file storage

Photographs, uploaded documents and generated PDFs must **not** live on the
application server: Vercel's filesystem is read-only and ephemeral, and a VPS
loses them on redeploy.

Any S3-compatible bucket works — AWS S3, Cloudflare R2, Backblaze B2, Supabase
Storage or self-hosted MinIO.

```
STORAGE_DRIVER="S3"
S3_ENDPOINT="https://s3.ap-south-1.amazonaws.com"    # or your provider's endpoint
S3_REGION="ap-south-1"
S3_BUCKET="tulsi-engineers-files"
S3_ACCESS_KEY_ID="…"
S3_SECRET_ACCESS_KEY="…"
```

Bucket settings:
- **Block all public access** — files are only ever served through `/api/files/[id]`,
  which checks either a signed-in session or a valid client report token.
- **Enable versioning** so a deleted or overwritten photograph can be recovered.
- Add a lifecycle rule to expire non-current versions after 90 days if cost matters.

---

## 3 · Generate the secrets

```bash
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('OTP_PEPPER='  + require('crypto').randomBytes(32).toString('base64url'))"
```

Never reuse these between environments, and never commit them.

---

## 4 · Environment variables

Set these on your hosting platform (Vercel → Project → Settings → Environment Variables).

### Required

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | Pooled connection |
| `AUTH_SECRET` | 64-char random | Signs session tokens |
| `OTP_PEPPER` | 43-char random | Hashes one-time passwords |
| `APP_URL` | `https://service.tulsiengineers.com` | Used to build client report links — must be the public HTTPS address |
| `NODE_ENV` | `production` | Set automatically by Vercel |

### Storage

`STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MAX_UPLOAD_MB`

### Email

| Variable | Notes |
|---|---|
| `MAIL_DRIVER` | `SMTP` to send for real, `LOG` to record without sending |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASSWORD` | From your provider |
| `MAIL_FROM_NAME` `MAIL_FROM_EMAIL` `MAIL_REPLY_TO` | Sender identity |

For deliverability, add SPF, DKIM and DMARC records for the sending domain.
Amazon SES (ap-south-1), Brevo, Zoho Mail and Google Workspace SMTP all work.

### WhatsApp Business Cloud API

| Variable | Notes |
|---|---|
| `WHATSAPP_DRIVER` | `CLOUD_API` to send for real, `LOG` to record without sending |
| `WHATSAPP_PHONE_NUMBER_ID` | From WhatsApp Manager |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | From WhatsApp Manager |
| `WHATSAPP_ACCESS_TOKEN` | Use a **System User** permanent token, not a 24-hour test token |
| `WHATSAPP_API_VERSION` | `v25.0` |

See [`INTEGRATIONS.md`](INTEGRATIONS.md) for the template approval process.

### OTP and links

`OTP_LENGTH` `OTP_TTL_MINUTES` `OTP_MAX_ATTEMPTS` `OTP_MAX_RESENDS` `CLIENT_LINK_TTL_DAYS`

### PDF

| Variable | Notes |
|---|---|
| `PDF_DRIVER` | `AUTO` (default), `CHROMIUM` to require real PDFs, `HTML` to skip Chromium entirely |
| `CHROMIUM_PATH` | Only when the host does not ship Chromium — see below |

---

## 5 · PDF generation on serverless

Vercel's Node runtime has no browser on the filesystem. One command fixes it:

```bash
npm install @sparticuz/chromium
```

That is all. `src/lib/pdf/engine.ts` already detects a serverless host
(`VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` in the environment), loads the package
if it is present, and uses the launch flags it recommends. Nothing else to edit.

If you would rather not ship a browser binary, set `PDF_DRIVER=HTML`. Documents
are then delivered as a self-contained, print-ready HTML file that opens in any
browser and prints to PDF in one click. Layout, branding, photographs and page
structure are identical.

The application never pretends HTML is a PDF: the content type, the file
extension and the interface all say which one you got.

**Verified against Vercel's current limits** (checked August 2026):

| Limit | Value | Effect here |
|---|---|---|
| Function duration | 300 s on Hobby; up to 800 s on Pro | Ample. The PDF routes set `maxDuration = 120`. |
| Function memory | 2 GB on Hobby, up to 4 GB on Pro | Chromium fits within 2 GB for these documents |
| Bundle size | 250 MB uncompressed | `@sparticuz/chromium` is roughly 50 MB — comfortable |
| **Request body** | **4.5 MB** | See below — this one genuinely bites |

### The 4.5 MB request body limit

A photograph straight off a phone is 4–8 MB. Untouched, a single upload would
be rejected outright.

The uploader therefore **shrinks each photograph in the browser** (long edge
capped at 1600 px, JPEG quality 0.82 — typically 4 MB down to about 350 KB) and
**sends one photograph per request**. A dropped connection then loses one
photograph rather than all forty, progress is visible, and an engineer on mobile
data in a boiler house uploads a tenth of the bytes.

No configuration is needed; it is how `PhotoUploader` already works. Keep it in
mind if you ever add another upload path.

## 6 · Deploy

### Vercel

```bash
npm i -g vercel
vercel link
vercel env pull .env.local        # sanity-check what is set
vercel --prod
```

Build settings are picked up automatically. `postinstall` runs `prisma generate`.

Run the migration once against the production database:

```bash
DATABASE_URL="<direct, non-pooled URL>" npx prisma migrate deploy
DATABASE_URL="<direct, non-pooled URL>" npx tsx prisma/seed.ts --no-demo
```

`--no-demo` seeds roles, permissions, service types, templates and settings but
**not** the ABC Industries sample data. Use it for a live installation.

### Docker / VPS

```bash
docker compose up -d           # app + postgres + minio
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx prisma/seed.ts --no-demo
```

Put Caddy or nginx in front for automatic Let's Encrypt certificates. HTTPS is
not optional: session cookies are marked `secure` in production and will not be
sent over plain HTTP.

---

## 7 · First-run checklist

1. Sign in as `admin` / `Tulsi@2026`.
2. **Change the password immediately** (avatar menu → Change password).
3. Admin → System Settings → Company profile: address, GSTIN, phone, email,
   website, logo URL, signature image, PDF footer and terms.
4. System Settings → Branding: set the three theme colours.
5. System Settings → Document numbering: confirm the prefixes.
6. System Settings → Integrations: check email and WhatsApp both show **Live**,
   then send a test message on each.
7. Users: create real accounts, mark engineers and technicians, delete or
   deactivate the demo accounts.
8. Service Master: add or deactivate service types to match what you actually sell.
9. Templates: adjust the email wording; map the WhatsApp templates to the names
   Meta approved.
10. Customers: enter your real customers, sites and equipment.

---

## 8 · Verify the deployment

```bash
curl https://your-domain/api/health
```

A healthy response reports `"status":"healthy"` and an empty `configProblems`
array. Anything listed there is a real production misconfiguration — most often
`AUTH_SECRET` or `OTP_PEPPER` still at their development defaults.

Then walk the acceptance workflow once by hand: create a job, assign it, record a
visit, raise a MOM, send it, confirm it from a phone.

---

## 9 · Backups

Three layers, described in full on the Backup & Data screen:

1. **Database** — managed point-in-time recovery from Neon or Supabase. This is
   the primary protection. Confirm the retention window on your plan.
2. **Files** — object storage versioning, so a deleted photograph is recoverable.
3. **Portable snapshot** — `GET /api/backup` returns every business record as a
   single JSON file, excluding password hashes, sessions, reset tokens and OTPs.
   Download it monthly and before any major change; keep it off-site.

Restore, in order: recover the database, point `DATABASE_URL` at it, run
`npm run db:deploy`, restore the bucket, then spot-check a job, its photographs
and a generated PDF.

A backup that has never been restored is only a hope — restore into staging once
a quarter.

---

## 10 · Environments

Keep three, each with its own database, bucket and secrets:

| Environment | Database | Storage | Drivers |
|---|---|---|---|
| Development | local Postgres | `STORAGE_DRIVER=LOCAL` | `MAIL_DRIVER=LOG`, `WHATSAPP_DRIVER=LOG` |
| Staging | Neon branch | separate bucket | `LOG`, or real credentials with test recipients |
| Production | Neon main | production bucket | `SMTP`, `CLOUD_API` |

Never point a staging deployment at the production database: the client portal
issues real links and the OTP service sends real WhatsApp messages to real
customers.

---

## 11 · Monitoring

- `/api/health` — wire it to your uptime monitor; it returns 503 when the
  database is unreachable or the configuration is unsafe.
- Vercel logs, or `docker compose logs -f app`, capture every server-side error.
  Errors are logged in full server-side and never returned to the browser.
- Admin → Audit Logs is the business-level record: who did what, when, from where.
- Admin → Email History and WhatsApp History show every message, including
  failures with the provider's error text.

# API reference

All endpoints live under `/api`. Every request except the auth and client-portal
routes requires a valid session cookie, and every handler checks a permission.

## Response shape

```jsonc
// success
{ "success": true, "data": { … } }

// list endpoints
{ "success": true, "data": [ … ], "meta": { "total": 128, "page": 1, "pageSize": 25, "pageCount": 6 } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Please correct the highlighted fields.", "details": { "companyName": "Company name is required" } } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Not signed in, or the session was revoked |
| 403 | `FORBIDDEN` | Signed in, but the role lacks the permission |
| 404 | `NOT_FOUND` | Record missing, or an invalid client token |
| 409 | `CONFLICT` | Business rule violation — locked document, illegal status change, record in use |
| 410 | `OTP_EXPIRED` / `OTP_CONSUMED` | The code is no longer usable |
| 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | Upload rejected |
| 422 | `VALIDATION_ERROR` | Field errors in `details` |
| 423 | `LOCKED` | Account locked after repeated failed sign-ins |
| 429 | `RATE_LIMITED` | Too many OTP requests |
| 500 | `INTERNAL_ERROR` | Logged server-side; no detail is returned |

## Common list parameters

`?page=1&pageSize=25&q=<search>&sort=<field>&dir=asc|desc` plus the filters
listed per endpoint. `pageSize` is capped at 200.

---

## Authentication — `/api/auth`

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/login` | public | `{ email, password }` — email or username. Locks the account for 15 minutes after 5 failures. Returns `redirectTo`. |
| POST | `/logout` | session | Revokes the session row, not just the cookie |
| GET | `/me` | session | Current user with the full permission list |
| POST | `/forgot-password` | public | Always succeeds — never reveals whether an account exists |
| POST | `/reset-password` | public | `{ token, password, confirmPassword }` — revokes all that user's sessions |
| POST | `/change-password` | session | `{ currentPassword, password, confirmPassword }` |

## Masters

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/customers` | `customers.view` / `customers.create` |
| GET / PUT / DELETE | `/customers/[id]` | `customers.view` / `.edit` / `.delete` |
| GET | `/customers/options` | `customers.view` |
| GET / POST | `/sites` · GET/PUT/DELETE `/sites/[id]` · GET `/sites/options` | `sites.*` |
| GET / POST | `/equipment` · GET/PUT/DELETE `/equipment/[id]` · GET `/equipment/options` | `equipment.*` |
| GET / POST | `/service-types` · PUT/DELETE `/service-types/[id]` · GET `/service-types/options` | `masters.*` |

Deletes are soft (`deletedAt`) and are refused with 409 when the record is
referenced by a service job.

## Jobs and visits

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET / POST | `/jobs` | `jobs.view` / `jobs.create` | Filters: `status`, `priority`, `customerId`, `siteId`, `engineerId`, `serviceTypeId`, `from`, `to`, `overdue=1`, `amc=1`. Engineers see only their own jobs. |
| GET / PUT / DELETE | `/jobs/[id]` | `jobs.*` | |
| POST | `/jobs/[id]/status` | `jobs.edit` | `{ status, remarks?, progressPercent? }` — enforces the status flow |
| POST | `/jobs/[id]/assign` | `jobs.assign` | `{ engineerId?, technicianId?, plannedVisitDate?, remarks?, notify }` |
| GET / POST | `/visits` | `visits.*` | |
| GET / PUT / DELETE | `/visits/[id]` | `visits.*` | |
| POST | `/visits/[id]/submit` | `visits.edit` | |

**Job status flow.** `NEW → ASSIGNED → SITE_VISIT → MOM_CREATED → WORK_STARTED →
WORK_IN_PROGRESS → CONFIRMATION_PENDING → COMPLETED → CLOSED`. Forward jumps are
allowed, one step back is allowed, `CANCELLED` only before completion. Anything
else returns 409 with an explanation.

## MOM and action points

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/mom` | `mom.view` / `mom.create` |
| GET / PUT / DELETE | `/mom/[id]` | `mom.*` |
| POST | `/mom/[id]/submit` | `mom.edit` |
| POST | `/mom/[id]/revise` | `mom.edit` |
| GET | `/action-points` | `mom.view` |
| PATCH | `/action-points/[id]` | `mom.edit` |
| POST | `/action-points/[id]/convert` | `jobs.create` |

`convert` turns an action point into a service job, copying the customer, site
and equipment, seeding the description from the action point, and linking the
two through `sourceActionPointId`. A second conversion returns 409.

## Reports

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/daily-reports` · GET/PUT/DELETE `/daily-reports/[id]` · POST `/daily-reports/[id]/submit` | `daily_reports.*` |
| GET / POST | `/final-reports` · GET/PUT/DELETE `/final-reports/[id]` · POST `/final-reports/[id]/submit` | `final_reports.*` |
| POST | `/final-reports/generate` | `final_reports.create` |

`generate` builds a draft final report by aggregating the job: work dates from
the daily reports, day-by-day work performed, de-duplicated materials and spares
with summed quantities, and the closing observations from the last report.

## Documents — `/api/documents/[docType]/[id]`

`docType` is `MOM`, `DAILY_WORK_REPORT`, `FINAL_SERVICE_REPORT` or `SITE_VISIT_REPORT`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/preview` | `<module>.view` | Branded HTML, renders inline in a browser tab |
| GET | `/pdf` | `<module>.pdf` | `?inline=1` to display rather than download. Photographs are embedded. |
| POST | `/send` | `<module>.email` or `<module>.whatsapp` | See below |
| POST | `/revise` | `<module>.edit` | Raises the version, clears the confirmation, revokes outstanding links |
| GET / DELETE | `/links` | `<module>.view` | List or revoke client links. Token hashes are never returned. |

**Send request**

```jsonc
{
  "channels": ["EMAIL", "WHATSAPP"],
  "toEmail": "…",           // optional override
  "toWhatsapp": "…",        // optional override
  "cc": "…",
  "message": "…",
  "attachPdf": true,
  "allowCorrection": true
}
```

**Send response**

```jsonc
{
  "results": [
    { "channel": "EMAIL",    "delivered": true,  "to": "rakesh@…" },
    { "channel": "WHATSAPP", "delivered": false, "simulated": true, "to": "919825011111" }
  ],
  "linkUrl": "https://…/report/ab12…",
  "linkId": "…",
  "pdfFileName": "TE-MOM-2026-27-0001-v1.pdf",
  "fallback": false          // true when Chromium was unavailable and HTML was produced
}
```

## Files

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/photos` | `photos.view` / `photos.create` (multipart, up to 40 images) |
| PATCH / DELETE | `/photos/[id]` | `photos.create` / `photos.delete` |
| GET / POST | `/files/documents` | `photos.view` / `photos.create` (multipart, up to 20 files) |
| DELETE | `/files/documents/[id]` | `photos.delete` |
| GET | `/files/[id]?type=photo\|document\|pdf` | session **or** `&t=<client token>` |

`/files/[id]` is the only way to read a stored file. With a client token it
serves only files belonging to that customer's records.

## Client portal — `/api/client/[token]` (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | The document in client-safe form. Increments the view count. |
| POST | `/otp` | `{ channel?: "WHATSAPP" \| "EMAIL" }` → `{ otpId, maskedDestination, channel, expiresInSeconds }` |
| POST | `/confirm` | `{ otpId, code, clientName? }` — verifies, records the confirmation, locks the document |
| POST | `/correction` | `{ remarks, clientName? }` — refused with 403 when the link disallows corrections |
| GET | `/pdf` | The document PDF; `?download=1` to attach |

## Insight

| Method | Path | Permission |
|---|---|---|
| GET | `/dashboard` | `dashboard.view` — 15 cards, 5 charts, 4 lists |
| GET | `/search?q=` | permission-aware across 9 record types |
| GET | `/analytics?report=<key>` | `analytics.view` |
| GET | `/analytics/export?report=<key>&format=csv\|xlsx` | `analytics.export` |
| GET | `/notifications` · POST `/notifications/read` | `notifications.view` |
| GET | `/audit-logs` · GET `/audit-logs/export` | `audit.view` / `audit.export` |
| GET | `/confirmations` | `confirmations.view` |
| GET | `/email-logs` · `/whatsapp-logs` | `email.view` / `whatsapp.view` |

Report keys: `customer-wise`, `site-wise`, `engineer-wise`, `service-wise`,
`date-wise`, `job-wise`, `pending-jobs`, `completed-jobs`, `mom-pending`,
`confirmation-pending`, `amc`, `breakdown`, `material-usage`, `spare-usage`,
`work-hours`.

## Administration

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/users` · GET/PUT/DELETE `/users/[id]` | `users.*` |
| POST | `/users/[id]/reset-password` | `users.manage` — returns a temporary password once |
| GET / DELETE | `/users/[id]/sessions` | `users.view` / `users.manage` |
| GET | `/staff/options` | `staff.view` or `jobs.view` |
| GET / POST | `/roles` · GET/PUT/DELETE `/roles/[id]` | `roles.*` |
| GET | `/permissions` | `roles.view` — the full catalogue |
| GET / PUT | `/settings` | `settings.view` / `settings.edit` |
| GET | `/settings/integrations` | `settings.view` — status only, never values |
| POST | `/settings/test-email` · `/settings/test-whatsapp` | `settings.manage` |
| GET / PUT | `/email-templates` · `/whatsapp-templates` (+ `/[id]`) | `templates.*` |
| GET | `/backup` · `/backup/stats` | `backup.manage` / `backup.view` |
| GET | `/health` | public |

## Permissions

Codes are `<module>.<action>`. 23 modules × their valid actions = 107 permissions.

Modules: `dashboard`, `customers`, `sites`, `equipment`, `jobs`, `visits`, `mom`,
`daily_reports`, `final_reports`, `photos`, `staff`, `confirmations`, `email`,
`whatsapp`, `analytics`, `notifications`, `audit`, `users`, `roles`, `masters`,
`templates`, `settings`, `backup`.

Actions: `view`, `create`, `edit`, `delete`, `approve`, `assign`, `pdf`,
`download`, `print`, `email`, `whatsapp`, `confirm`, `manage`, `export`.

`GET /api/permissions` returns the authoritative catalogue — build any
permission interface from it rather than hard-coding the list.

## Extending the API later

The schema was designed so CRM, quotations, purchase, inventory, spare parts,
AMC contracts, invoicing, payments, attendance and expenses can be added without
touching the existing tables. Follow the pattern in
`src/app/api/customers/route.ts`: guard, validate with zod, write, audit, return.

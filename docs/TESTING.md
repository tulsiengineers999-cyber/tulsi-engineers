# Testing

Two suites, both run against a live server with a seeded database.

```bash
npm run db:reset && npm run db:seed    # clean, known starting point
npm run dev                            # in one terminal

npm run test:acceptance                # in another
npm run test:ui
```

`test:acceptance` must run against a **development** server: the OTP service
returns the generated code in a `devCode` field outside production so the
confirmation flow can be exercised without a real WhatsApp number. Against a
production build those checks will fail by design.

`test:ui` is happiest against a production build (`npm run build && npm start`) —
a development server compiles each page on first visit and the run takes far longer.

---

## `npm run test:acceptance` — 78 checks

Walks the full acceptance workflow through the real HTTP API, in order, holding
three separate sessions (admin, engineer, anonymous client).

| Section | What it proves |
|---|---|
| 0 · Health | The database is reachable |
| 1 · Authentication | Unauthenticated access is refused; wrong passwords are counted; admin and engineer sign in; an engineer is denied the Users module |
| 2 · Masters | Customer, site and equipment are created; an invalid customer returns a field-level error |
| 3 · Job & assignment | Job created with a fiscal-year number; an engineer cannot assign; admin assigns and the status advances |
| 4 · Site visit | Visit recorded by the engineer, submitted, and the job advances to SITE_VISIT |
| 5 · Photographs | Upload, authorised read, and refusal without a session |
| 6 · MOM | MOM created with participants and individually trackable action points, then submitted |
| 7 · PDF | Preview renders with the document number; a real PDF is produced |
| 8 · Send | Email and WhatsApp both dispatched, a secure link issued, status advanced, token hash never exposed |
| 9 · Client portal & OTP | Client opens without signing in; payload carries no secrets; a tampered token is refused; photographs load with the token; OTP requested, wrong code counted, correct code confirms, reuse blocked; the document locks against editing |
| 10 · Action points | Converted into a service job; a second conversion is refused |
| 11 · Daily work | Report created with materials and spares, submitted, sent, confirmed by OTP |
| 12 · Final report | Generated from the job's daily work, duplicate refused, submitted, PDF produced, sent, confirmed; correction refused when the link disallows it |
| 13 · Versioning | Revision raises the version, returns the document to draft, and withdraws the superseded link |
| 14 · Completion & reporting | Job completed; an illegal status jump refused; history links every record; search, dashboard, analytics, CSV and Excel export |
| 15 · Audit & backup | The MOM lifecycle appears in the audit log; failed sign-ins are recorded; email and WhatsApp history captured without credentials; backup excludes secrets; an engineer cannot download it |
| 16 · Teardown | Sign-out revokes the session server-side |

Each run creates fresh records, so it can be run repeatedly without resetting.

---

## `npm run test:ui` — 57 screens

Loads every screen in headless Chromium as a real signed-in user and fails on:

- a non-2xx response or a 5xx from any request the page makes,
- an uncaught client-side exception,
- a console error,
- a rendered error boundary,
- a page that renders almost nothing,
- horizontal overflow at 390 px on the screens checked at phone width.

Covered: 3 public pages, 30 admin list and form pages, 14 record detail and edit
pages, 4 admin screens re-checked at phone width, and all 6 field screens at
phone width. Screenshots land in `/tmp/te-shots`.

Pass record ids so the detail pages are exercised against real data:

```bash
TE_RECORD_IDS='{"Job detail":"/jobs/<id>"}' npm run test:ui
```

---

## Client portal check

```bash
node scripts/client-portal-check.mjs
```

Issues a fresh client link, then confirms in a real browser at phone width that
the report renders, no admin navigation leaks into it, there is no horizontal
overflow, the confirm control is present, an invalid link degrades to a friendly
message rather than an error page, and the generated PDF is a real PDF.

---

## What to check by hand

Automated tests cannot judge these:

**On a real phone** — the field interface on Android and iPhone: camera capture,
gallery multi-select, the one-tap time stamps, and whether the buttons are
comfortable with gloves on. Test on a slow connection, in a boiler house, with
one hand.

**Client experience** — send yourself a MOM at a personal email address and
WhatsApp number. Read the message as a customer would. Is the wording right? Is
the link obvious? Does the OTP arrive quickly?

**PDF output** — print a MOM and a final service report on A4 and look at them
next to your existing paperwork. Check the letterhead, the photograph sizes, the
page breaks, and whether the signature block sits where your customers expect it.

**Permissions** — sign in as each role and confirm the navigation shows only what
that role should see, and that a direct URL to a forbidden page is refused rather
than rendering empty.

---

## Before every release

```bash
npm run typecheck        # must be clean
npm run lint             # must be clean
npm run build            # must succeed
npm run test:acceptance  # 78/78
npm run test:ui          # 57/57
curl localhost:3000/api/health
```

Then restore last month's backup into a staging database and confirm a job, its
photographs and a generated PDF all open correctly.

# TULSI ENGINEERS — Service & Site Work Management

A production-ready cloud application that runs every service activity end to end:
from the first customer request through to the client's OTP-verified sign-off on
the final service report.

> **Manufacturer, Supplier, Repairer & Service Provider of Industrial Boilers,
> Heaters, Pollution Control Equipment & Accessories**

---

## The workflow it manages

```
Service request → Job → Engineer assignment → Site visit → MOM →
Client MOM confirmation → Action points → Daily work + photos →
Daily report → Client confirmation → Work completion →
Final service report → PDF → Email + WhatsApp → Final confirmation →
Complete service history
```

Every record stays connected:

```
Customer → Site → Equipment → Service job → Site visit → MOM → Action points
        → Daily work → Photos → Reports → Final report → Confirmations → Communication history
```

---

## What is in the box

| Area | Included |
|---|---|
| **Panels** | Admin, Service Manager, Engineer/Technician mobile field view, secure client report portal |
| **Masters** | Customers (multi-contact), sites (with GPS), equipment (spec sheet, AMC, warranty), 43 configurable service types |
| **Operations** | Service jobs with a status machine, site visits, MOM with trackable action points, daily work reports with materials and spares, final service reports |
| **Documents** | Server-side branded PDFs for site visit, MOM, daily work and final service reports, with embedded photographs and "Page X of Y" |
| **Client portal** | Tokenised links, no admin surface, OTP confirmation bound to the exact document version, correction requests |
| **Communication** | SMTP email with editable templates and full history; WhatsApp Business Cloud API with template mapping and full history |
| **Security** | bcrypt passwords, revocable DB-backed sessions, 107 permissions across 23 modules, 8 default roles, failed-login lockout, audit log of every meaningful action |
| **Insight** | Dashboard with 15 KPIs and 5 charts, 15 analytics reports, PDF/Excel/CSV export, global search, notifications |
| **Administration** | Editable company profile, theme colours, document numbering, file limits, notification rules, OTP policy, PDF options, role permission matrix, JSON backup |

---

## Quick start

```bash
# 1 · Install
npm install

# 2 · Configure
cp .env.example .env      # then fill in DATABASE_URL, AUTH_SECRET, OTP_PEPPER

# 3 · Create the database schema
npm run db:migrate

# 4 · Load roles, permissions, masters, templates and demo data
npm run db:seed

# 5 · Run
npm run dev               # http://localhost:3000
```

### Demo accounts

All use the password `Tulsi@2026`. **Change every one of them before going live.**

| Username | Role | Sees |
|---|---|---|
| `admin` | Super Admin | Everything |
| `manager` | Service Manager | Operations, approvals, assignment |
| `engineer` | Service Engineer | Mobile field view, own jobs |
| `technician` | Technician | Mobile field view, daily work |
| `office` | Office Staff | Data entry and client communication |

The demo data includes a complete worked example: ABC Industries Pvt. Ltd. →
Ahmedabad Plant → 2 TPH Steam Boiler → preventive maintenance job → site visit →
MOM with six action points → two daily reports → final service report → four
client confirmations.

---

## Architecture

```
Next.js 15 (App Router)  ·  TypeScript (strict)  ·  Tailwind CSS v4
        │
        ├── Server components for every read-heavy screen
        ├── Small client islands for forms, modals and uploads
        └── REST API routes under /api, all permission-guarded
                │
                ├── Prisma 6 → PostgreSQL (Neon / Supabase / any managed PG)
                ├── Object storage (S3-compatible) for photos, documents and PDFs
                ├── Chromium (headless) for server-side PDF generation
                ├── Nodemailer for SMTP email
                └── WhatsApp Business Cloud API (Graph API)
```

### Where things live

```
prisma/schema.prisma          31 models — the authoritative data model
prisma/seed.ts                roles, permissions, masters, templates, demo data

src/lib/
  env.ts                      typed access to every environment variable
  prisma.ts                   database client
  rbac.ts                     107 permissions, 8 default roles
  guard.ts                    requireUser / requirePermission / scopeToOwnJobs
  audit.ts                    audit trail with automatic secret redaction
  numbering.ts                fiscal-year document numbering, transaction-safe
  settings.ts                 runtime configuration, cached
  storage.ts                  local disk or any S3-compatible bucket
  analytics.ts                the 15 report definitions
  auth/                       password hashing, JWT + DB session
  pdf/                        layout, engine, image embedding
  services/                   documents, dispatch, email, whatsapp, otp, templates
  validation/                 zod schemas for every write

src/app/
  (auth)/                     sign in, forgot password, reset password
  (app)/                      the admin application — 25 modules
  (field)/                    the engineer's mobile interface
  (client)/                   the public, token-authenticated client report
  api/                        79 route handlers

src/components/
  ui/                         design system: primitives, table, modal, toast, photos
  layout/                     sidebar, top bar, global search, page header
  documents/                  the shared "send to client" dialogue
```

---

## Business rules enforced in code

1. Job, MOM, daily report and final report numbers are unique and allocated
   inside a database transaction, so two users can never receive the same one.
2. Numbers carry the Indian financial year (`TE/JOB/2026-27/0001`) and reset
   each 1 April.
3. Every record is linked to a job; every job to a site; every site to a customer.
4. A client confirmation is bound to the exact document **version** that was viewed.
5. A client-confirmed document is locked. Editing requires **Revise**, which
   raises the version, clears the confirmation and withdraws every outstanding
   client link.
6. Re-sending an already-confirmed document does **not** reopen the confirmation.
7. One-time passwords are stored only as a peppered SHA-256 digest, expire,
   are single-use, and are rate-limited by destination.
8. Client links are opaque tokens stored as hashes, expire, and can be revoked.
9. A report token can only read files belonging to that customer's records.
10. Field users see only the jobs they are assigned to.
11. Service types, job statuses, company details and message templates are all
    stored data, never hard-coded.
12. API credentials never leave the server and never appear in a log record.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed roles, masters, templates and demo data |
| `npm run db:studio` | Browse the database |
| `npm run test:acceptance` | 78-check end-to-end workflow test |
| `npm run test:ui` | Renders all 57 screens in a real browser |

---

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying to Vercel + Neon/Supabase, storage, SSL, backups
- [`docs/API.md`](docs/API.md) — every endpoint, its permission and its shape
- [`docs/TESTING.md`](docs/TESTING.md) — how to run and read the test suites
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — WhatsApp Business API, SMTP and OTP setup

---

## Current status

| Stage | State |
|---|---|
| Stage 1 — functional prototype | Complete, backed by a real database from the first screen |
| Stage 2 — MVP | Complete: auth, database, storage, PDF, email, client links, OTP |
| Stage 3 — production | Complete: WhatsApp Cloud API, notifications, roles, audit, backup, security headers, error handling, PWA-friendly mobile interface |

Verified by `npm run test:acceptance` (78/78) and `npm run test:ui` (57/57 screens).

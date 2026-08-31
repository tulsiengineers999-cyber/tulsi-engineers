# 🚀 Deployment Guide — Tulsi Engineers on Vercel

## Prerequisites
- Git repository pushed to GitHub / GitLab / Bitbucket
- [Vercel account](https://vercel.com) (free tier is sufficient)
- A hosted **PostgreSQL** database (see Step 1)
- An **S3-compatible** file storage bucket (see Step 2)

---

## Step 1: PostgreSQL Database Setup

> **Vercel's filesystem is ephemeral — you MUST use a hosted database.**

### Option A: Neon (Recommended — Free)
1. Go to [neon.tech](https://neon.tech) → Create account → **New Project**
2. Database name: `tulsi_engineers`
3. Click **Connect** → copy the connection string
   Format: `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/tulsi_engineers?sslmode=require`

### Option B: Supabase (Free)
1. Go to [supabase.com](https://supabase.com) → New Project
2. Settings → Database → **Connection string** (URI tab)

### Option C: Vercel Postgres (Paid)
1. Vercel Dashboard → Storage → Create → PostgreSQL
2. The `DATABASE_URL` will be added to your project automatically

---

## Step 2: S3-Compatible File Storage Setup

> **⚠️ Uploaded files (photos, documents) are permanently lost on Vercel if you use LOCAL storage.**
> You MUST use an S3-compatible service.

### Option A: Cloudflare R2 (Recommended — Free egress)
1. [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket: `tulsi-engineers`
2. R2 → Manage R2 API Tokens → Create Token (Object Read & Write)
3. Note: Account ID, Access Key ID, Secret Access Key
4. Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### Option B: AWS S3
1. Create bucket in AWS Console (e.g., `tulsi-engineers-prod`)
2. Create IAM user → Generate Access Key ID and Secret

### Option C: Supabase Storage (S3-compatible)
1. Supabase Dashboard → Storage → Create bucket: `tulsi-engineers`
2. Storage → Settings → S3 Connection → copy credentials

---

## Step 3: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import repository
3. Framework Preset: **Next.js** (auto-detected)
4. Add environment variables (see Step 4) → Click **Deploy**

The build command (`npm run vercel-build`) will automatically:
- Generate the Prisma client
- Apply all database migrations (`prisma migrate deploy`)
- Build the Next.js app

---

## Step 4: Environment Variables

Add ALL of the following in **Vercel → Project → Settings → Environment Variables**:

### Required — Database
```
DATABASE_URL=postgresql://user:password@host/tulsi_engineers?sslmode=require
```

### Required — App
```
APP_NAME=TULSI ENGINEERS
APP_URL=https://your-project-name.vercel.app
NODE_ENV=production
AUTH_SECRET=<generate a strong random string>
SESSION_TTL_HOURS=12
OTP_PEPPER=<generate a strong random string>
```

### Required — Storage (S3)
```
STORAGE_DRIVER=S3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=tulsi-engineers
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
MAX_UPLOAD_MB=15
```

### Optional — Email (defaults to LOG / no emails sent)
```
MAIL_DRIVER=SMTP
MAIL_FROM_NAME=TULSI ENGINEERS
MAIL_FROM_EMAIL=service@yourdomain.com
MAIL_REPLY_TO=service@yourdomain.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=service@yourdomain.com
SMTP_PASSWORD=your-hostinger-mailbox-password
```

Create the mailbox in Hostinger before deploying. For port `587`, set
`SMTP_SECURE=false` to use STARTTLS. Keep the mailbox password in the hosting
provider's environment variables and use the same domain mailbox for
`SMTP_USER` and `MAIL_FROM_EMAIL`.

### Optional — WhatsApp (defaults to LOG / no messages sent)
```
WHATSAPP_DRIVER=CLOUD_API
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-account-id
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_DEFAULT_LANGUAGE=en
```

### Optional — Other
```
CLIENT_LINK_TTL_DAYS=30
PDF_DRIVER=AUTO
```

---

## Step 5: First-Time Database Seed (One-Time Only)

The build automatically runs `prisma migrate deploy` to create all tables. However, it does **not** seed the admin user. Run this **once** locally pointing at your production database:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

Default login after seeding:
- **Username:** `admin`
- **Password:** `Tulsi@2026`

---

## Step 6: Update APP_URL After First Deploy

1. Copy your Vercel URL (e.g., `https://tulsi-engineers.vercel.app`)
2. Update `APP_URL` in Vercel → Environment Variables
3. Redeploy (Vercel → Deployments → Redeploy)

---

## Step 7: Custom Domain (Optional)

1. Vercel Dashboard → Project → Domains → Add Domain
2. Follow DNS configuration instructions
3. Update `APP_URL` to your custom domain

---

## Troubleshooting

### Build Fails — Database errors
- Verify `DATABASE_URL` is a valid PostgreSQL URL (not SQLite `file:./dev.db`)

### Files Not Saving / Photos Lost After Redeploy
- Set `STORAGE_DRIVER=S3` — LOCAL storage doesn't persist on Vercel

### PDF Generated as HTML
- Install `@sparticuz/chromium` for real PDFs, or set `PDF_DRIVER=HTML`

---

## Production Checklist

- [ ] PostgreSQL database created and `DATABASE_URL` set
- [ ] S3 bucket created and all S3 env vars set (`STORAGE_DRIVER=S3`)
- [ ] Strong random `AUTH_SECRET` and `OTP_PEPPER` set
- [ ] `APP_URL` updated to real Vercel URL
- [ ] Database seeded once with `npm run db:seed`
- [ ] Login tested with `admin` / `Tulsi@2026`
- [ ] Custom domain configured (optional)

---

## References
- [Vercel Docs](https://vercel.com/docs)
- [Neon Serverless Postgres](https://neon.tech/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)

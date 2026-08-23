# 🚀 Deployment Guide for Vercel

## Prerequisites
- Git repository with your code
- Vercel account (free tier is sufficient)
- PostgreSQL database (Neon, Supabase, or Vercel Postgres)

## Step 1: Database Setup

### Option A: Neon (Recommended - Free)
1. Go to [neon.tech](https://neon.tech)
2. Create account → New Project
3. Database name: `tulsi_engineers`
4. Copy connection string (starts with `postgresql://`)

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com) 
2. Create account → New Project
3. Go to Settings → Database → Connection string
4. Copy the connection string

### Option C: Vercel Postgres
1. In Vercel dashboard → Storage → Create Database
2. Choose PostgreSQL
3. Copy the connection string

## Step 2: Deploy to Vercel

### From Git Repository:
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Configure environment variables (see below)
5. Deploy!

### Environment Variables to Add in Vercel:
```env
DATABASE_URL=postgresql://your-connection-string
AUTH_SECRET=oJ4MB7Dty-Nlp-oI9KrilaWNXIwRc7ZqWT_zlzM4Mmo
OTP_PEPPER=AMaQI8kqvQgQGg4JJKN2qGbELQcGSZhs
APP_URL=https://your-project-name.vercel.app
NODE_ENV=production
SESSION_TTL_HOURS=12
STORAGE_DRIVER=LOCAL
LOCAL_STORAGE_PATH=./storage
MAIL_DRIVER=LOG
WHATSAPP_DRIVER=LOG
MAIL_FROM_NAME=TULSI ENGINEERS
MAIL_FROM_EMAIL=service@tulsiengineers.com
WHATSAPP_DEFAULT_LANGUAGE=en
CLIENT_LINK_TTL_DAYS=30
PDF_DRIVER=AUTO
MAX_UPLOAD_MB=15
```

## Step 3: Post-Deployment

### Update APP_URL:
1. After first deployment, copy your Vercel URL
2. Update the `APP_URL` environment variable
3. Redeploy (automatic if connected to Git)

### Test Login:
Use these demo credentials:
- Username: `admin`
- Password: `Tulsi@2026`

## Step 4: Custom Domain (Optional)

1. In Vercel dashboard → Project → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `APP_URL` environment variable

## Troubleshooting

### Build Failures:
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify database connection string

### Database Issues:
- Confirm PostgreSQL connection string is correct
- Check database permissions
- Verify the database is accessible from Vercel's IP ranges

### Runtime Errors:
- Check function logs in Vercel dashboard
- Verify environment variables in production
- Check for missing dependencies

## Production Upgrades

### Email Configuration:
```env
MAIL_DRIVER=SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### File Storage (S3):
```env
STORAGE_DRIVER=S3
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
```

### WhatsApp Integration:
```env
WHATSAPP_DRIVER=CLOUD_API
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-token
```

## Support

- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Neon Documentation: [neon.tech/docs](https://neon.tech/docs)
- Next.js Deployment: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
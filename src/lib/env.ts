/**
 * Central, typed access to environment configuration.
 * Nothing in the application reads process.env directly.
 * Secrets are never exported to client components.
 */

function str(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}
function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
}
function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  isProd: str("NODE_ENV") === "production",
  appName: str("APP_NAME", "TULSI ENGINEERS"),
  appUrl: str("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  authSecret: str("AUTH_SECRET", "dev-only-secret-change-me-in-production-min-32-chars"),
  sessionTtlHours: num("SESSION_TTL_HOURS", 12),

  storage: {
    driver: str("STORAGE_DRIVER", "LOCAL") as "LOCAL" | "S3" | "DATABASE",
    localPath: str("LOCAL_STORAGE_PATH", "./storage"),
    s3: {
      endpoint: str("S3_ENDPOINT"),
      region: str("S3_REGION"),
      bucket: str("S3_BUCKET"),
      accessKeyId: str("S3_ACCESS_KEY_ID"),
      secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
      publicUrl: str("S3_PUBLIC_URL"),
    },
    maxUploadMb: num("MAX_UPLOAD_MB", 15),
  },

  mail: {
    driver: str("MAIL_DRIVER", "LOG") as "LOG" | "SMTP",
    host: str("SMTP_HOST"),
    port: num("SMTP_PORT", 587),
    secure: bool("SMTP_SECURE", false),
    user: str("SMTP_USER"),
    password: str("SMTP_PASSWORD"),
    fromName: str("MAIL_FROM_NAME", "TULSI ENGINEERS"),
    fromEmail: str("MAIL_FROM_EMAIL", "service@tulsiengineers.in"),
    replyTo: str("MAIL_REPLY_TO"),
  },

  whatsapp: {
    driver: str("WHATSAPP_DRIVER", "LOG") as "LOG" | "CLOUD_API",
    provider: str("WHATSAPP_PROVIDER", "WAPIO") as "META" | "WAPIO",
    apiVersion: str("WHATSAPP_API_VERSION", "v25.0"),
    phoneNumberId: str("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: str("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    accessToken: str("WHATSAPP_ACCESS_TOKEN"),
    wapio: {
      endpoint: str("WAPIO_ENDPOINT", "https://app.wapvio.com/api/v1/send"),
      apiKey: str("WAPIO_API_KEY"),
      instanceName: str("WAPIO_INSTANCE_NAME"),
    },
    defaultLanguage: str("WHATSAPP_DEFAULT_LANGUAGE", "en_US"),
  },

  otp: {
    length: num("OTP_LENGTH", 6),
    ttlMinutes: num("OTP_TTL_MINUTES", 10),
    maxAttempts: num("OTP_MAX_ATTEMPTS", 5),
    maxResends: num("OTP_MAX_RESENDS", 3),
    pepper: str("OTP_PEPPER", "dev-only-otp-pepper-change-me"),
  },

  clientLink: {
    ttlDays: num("CLIENT_LINK_TTL_DAYS", 30),
  },

  pdf: {
    driver: str("PDF_DRIVER", "AUTO") as "AUTO" | "CHROMIUM" | "HTML",
    chromiumPath: str("CHROMIUM_PATH"),
  },
};

/** Fails fast in production if a required secret is still at its dev default. */
export function assertProductionConfig(): string[] {
  const problems: string[] = [];
  if (!env.isProd) return problems;

  if (env.authSecret.startsWith("dev-only")) problems.push("AUTH_SECRET must be set to a strong random value");
  if (env.otp.pepper.startsWith("dev-only")) problems.push("OTP_PEPPER must be set to a strong random value");
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is required");
  if (env.appUrl.includes("localhost")) problems.push("APP_URL must be your public HTTPS URL");
  return problems;
}

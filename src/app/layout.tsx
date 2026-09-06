import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { getTheme } from "@/lib/settings";
import { getCompany } from "@/lib/settings";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany().catch(() => null);
  const name = company?.name ?? "TULSI ENGINEERS";
  const logo = "/logo.jpeg?v=2";
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: `${name} — Service Management`, template: `%s | ${name}` },
    description: company?.tagline ?? "Service & Site Work Management System",
    robots: { index: false, follow: false },
    icons: {
      icon: [{ url: logo, type: "image/jpeg" }],
      shortcut: [logo],
      apple: [{ url: logo, type: "image/jpeg" }],
    },
    openGraph: {
      title: `${name} — Service Management`,
      description: company?.tagline ?? "Service & Site Work Management System",
      type: "website",
      images: [{ url: logo, alt: name }],
    },
    twitter: {
      card: "summary",
      title: `${name} — Service Management`,
      description: company?.tagline ?? "Service & Site Work Management System",
      images: [logo],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#E52B1A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme().catch(() => null);

  return (
    <html lang="en">
      <head>
        {theme && (
          <style
            // Theme colours come from Admin → Settings and are injected at request time.
            dangerouslySetInnerHTML={{
              __html: `:root{--te-primary:${theme.primary};--te-accent:${theme.accent};--te-sidebar:${theme.sidebar};}`,
            }}
          />
        )}
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

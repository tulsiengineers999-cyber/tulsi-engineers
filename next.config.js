const path = require("node:path");

// ── Windows build fix ──────────────────────────────────────────────────────
// Next.js's file tracer uses glob to scan the filesystem for output tracing.
// On Windows, junction symlinks (e.g. "Application Data" → AppData\Roaming)
// are unreadable and throw EPERM, crashing the webpack FlightClientEntryPlugin.
// This guard swallows those specific OS-level errors so the build continues.
// This is a no-op on Linux (Vercel) where junctions don't exist.
if (process.platform === "win32") {
  const _origOn = process.on.bind(process);
  process.on = function (event, handler) {
    if (event === "unhandledRejection") {
      return _origOn(event, (reason, promise) => {
        if (reason && reason.code === "EPERM") return; // swallow Windows junction EPERM
        handler(reason, promise);
      });
    }
    return _origOn(event, handler);
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Constrain file-tracing scan to the project directory (avoids scanning
  // parent user-profile directories on Windows which contain EPERM junctions).
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Exclude Windows system paths from output file tracing.
  outputFileTracingExcludes: {
    "*": [
      "../../Users/**",
      "../../../Users/**",
      "**/AppData/**",
      "**/Application Data/**",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "prisma",
      "puppeteer-core",
      "@sparticuz/chromium",
      "exceljs",
      "nodemailer",
      "bcryptjs",
      "sharp",
    ],
    serverActions: {
      bodySizeLimit: "20mb",
    },
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  webpack(config, { dev, isServer }) {
    if (!dev) {
      config.devtool = false;
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
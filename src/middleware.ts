import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware. Two jobs:
 *  1. attach security headers to every response
 *  2. bounce unauthenticated visitors away from application routes
 *
 * The cookie is only checked for *presence* here — signature and revocation are
 * verified in `getCurrentUser()` on the server, because the Edge runtime cannot
 * reach the database.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/report",          // secure client report portal (token-authenticated)
  "/api/auth",
  "/api/client",
  "/api/health",
  "/_next",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Photographs and PDFs inside a client report are reached with the report's
  // own token. The route handler re-validates that token against the database;
  // this only lets the request through to it.
  const hasClientToken = pathname.startsWith("/api/files/") && Boolean(req.nextUrl.searchParams.get("t"));

  const isPublic =
    hasClientToken || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = Boolean(req.cookies.get("te_session")?.value);

  let res: NextResponse;

  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      res = NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } },
        { status: 401 },
      );
    } else {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
      res = NextResponse.redirect(url);
    }
  } else {
    res = NextResponse.next();
  }

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

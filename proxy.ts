import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication (redirect to login if no session)
const protectedPagePrefixes = ["/dashboard", "/novels", "/settings"];
const protectedApiPrefixes = ["/api/uploads", "/api/translation", "/api/reading"];

// Routes that should NOT get CSP headers (static assets, Next.js internals)
function shouldSkipCsp(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff")
  );
}

function isProtectedPage(pathname: string): boolean {
  return protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApi(pathname: string): boolean {
  return protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Checks whether the request carries a valid internal service token.
 * Internal server-to-server calls (e.g. translation continuation) use
 * this header instead of session cookies.
 */
function hasValidInternalToken(request: NextRequest): boolean {
  const token = request.headers.get("x-internal-token");
  return !!token && token === process.env.AUTH_SECRET;
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  // CSP directives:
  // - default-src 'self': only allow same-origin resources by default
  // - script-src: nonce-based for inline scripts (next-themes), 'strict-dynamic' for Next.js chunks
  //   Dev mode adds 'unsafe-eval' for React Fast Refresh / HMR
  // - style-src: 'unsafe-inline' is needed because Tailwind and next-themes inject inline styles;
  //   nonce-based style-src breaks Tailwind's runtime style injection in dev
  // - img-src: 'self' + https: for user avatars (Google OAuth) + data: for inline images
  // - font-src: 'self' for next/font/google (fonts are self-hosted at build time)
  // - connect-src: 'self' for API routes; dev adds ws: for HMR WebSocket
  // - frame-src: Google OAuth popup window
  // - object-src 'none': block Flash/Java embeds
  // - base-uri 'self': prevent base tag hijacking
  // - form-action 'self': restrict form submissions to same origin
  // - frame-ancestors 'self': replaces X-Frame-Options (CSP2+)
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' https: data:",
    "font-src 'self'",
    `connect-src 'self' https://*.r2.cloudflarestorage.com${isDev ? " ws:" : ""}`,
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip CSP for static assets and Next.js internals
  if (shouldSkipCsp(pathname)) {
    return NextResponse.next();
  }

  // --- CSP: generate nonce and set headers on every HTML-serving request ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeaderValue = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  // --- Auth gate: only for protected routes ---
  // Internal server-to-server calls authenticate via x-internal-token header
  if ((isProtectedPage(pathname) || isProtectedApi(pathname)) && !hasValidInternalToken(request)) {
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      if (isProtectedApi(pathname)) {
        const response = NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
        response.headers.set("Content-Security-Policy", cspHeaderValue);
        return response;
      }
      // For pages, redirect to login
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Return response with CSP headers ---
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeaderValue);

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};

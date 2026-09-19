import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/session-token";

// Optimistic, cookie-only redirects — a snappy UX layer, not the real
// authorization check. That check lives in src/lib/auth.ts's
// requireCoach()/requireAthlete(), called from every protected page and
// Route Handler; this file can be misconfigured or bypassed and the app
// still has to stay secure without it. See Next's authentication guide
// ("Optimistic checks with Proxy") for why the split is intentional.
//
// Named `proxy`, not `middleware`: Next 16 deprecated and renamed the
// middleware.js convention (same behavior) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.

const COACH_ONLY = ["/dashboard"];
const ATHLETE_ONLY = ["/checkin", "/progress", "/onboarding", "/pain", "/cycle"];
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (matches(pathname, COACH_ONLY) && session?.role !== "COACH") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (matches(pathname, ATHLETE_ONLY) && session?.role !== "ATHLETE") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (AUTH_PAGES.includes(pathname) && session) {
    return NextResponse.redirect(new URL(session.role === "COACH" ? "/dashboard" : "/progress", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

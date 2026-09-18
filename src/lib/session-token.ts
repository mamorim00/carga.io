import crypto from "crypto";

/**
 * Stateless, signed session cookies: `<base64url payload>.<base64url HMAC>`.
 * No server-side session store, on purpose — the rest of the app's data
 * (src/lib/data.ts) is already in-memory and reset on every cold start, so
 * a session store would have the same limitation without adding anything;
 * a signed cookie carries its own validity and needs no lookup at all.
 *
 * Used from both Route Handlers/Server Components (via src/lib/auth.ts,
 * which layers next/headers `cookies()` on top) and src/proxy.ts, which
 * reads the raw cookie off the request — hence no framework imports, and
 * deliberately no `import "server-only"`, here: that guard throws unless
 * the bundler sets the "react-server" condition, which Proxy's separate
 * compilation target isn't guaranteed to do. src/lib/auth.ts and
 * src/lib/password.ts carry the guard instead; neither is ever imported
 * from a Client Component.
 */

export const SESSION_COOKIE = "carga_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionRole = "COACH" | "ATHLETE";

export interface SessionPayload {
  sub: string; // Coach.id or Athlete.id
  role: SessionRole;
  exp: number; // unix seconds
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  // Prototype fallback so `npm run dev`, `npm test`, and this sandbox's
  // build all work with zero setup. Any real deployment must set
  // SESSION_SECRET (see README) — without it, every restart invalidates
  // existing sessions, and the signing key is guessable from this source.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "SESSION_SECRET is not set in production — sessions are signed with a public, insecure fallback key.",
    );
  }
  return "carga-dev-only-insecure-secret-do-not-use-in-production";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if ((payload.role !== "COACH" && payload.role !== "ATHLETE") || typeof payload.sub !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionPayload(sub: string, role: SessionRole): SessionPayload {
  return { sub, role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
}

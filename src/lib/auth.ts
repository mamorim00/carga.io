import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAthlete, getCoach } from "./data";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionPayload,
  decodeSession,
  encodeSession,
  type SessionPayload,
} from "./session-token";
import type { Athlete, Coach } from "./types";

/**
 * The DAL (data access layer) the Next.js auth guide recommends: every page
 * or Route Handler that needs the signed-in user calls requireCoach() /
 * requireAthlete() rather than reading the cookie itself, so the
 * authorization check can't be forgotten in one place and not another.
 * src/proxy.ts does its own optimistic check for a snappy redirect, but
 * these are the real gate.
 */

export async function createSession(sub: string, role: SessionPayload["role"]): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(createSessionPayload(sub, role)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** Redirects to /login unless the signed-in user is a coach; otherwise returns them. */
export async function requireCoach(): Promise<Coach> {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");
  const coach = getCoach(session.sub);
  if (!coach) redirect("/login");
  return coach;
}

/** Redirects to /login unless the signed-in user is an active athlete; otherwise returns them. */
export async function requireAthlete(): Promise<Athlete> {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");
  const athlete = getAthlete(session.sub);
  if (!athlete || athlete.status !== "ACTIVE") redirect("/login");
  return athlete;
}

// Route Handlers respond with JSON, not a redirect, so they use these
// instead of requireCoach()/requireAthlete() — same checks, no redirect().

export async function getSessionCoach(): Promise<Coach | null> {
  const session = await getSession();
  if (!session || session.role !== "COACH") return null;
  return getCoach(session.sub) ?? null;
}

export async function getSessionAthlete(): Promise<Athlete | null> {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") return null;
  const athlete = getAthlete(session.sub);
  return athlete && athlete.status === "ACTIVE" ? athlete : null;
}

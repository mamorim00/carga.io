import crypto from "crypto";

// scrypt over bcrypt/argon2 because it needs no dependency beyond Node's
// built-in `crypto` — this app has already been burned once by a peer-
// dependency conflict from an unrelated devDependency bump, so new runtime
// dependencies are worth avoiding where a built-in does the job.
//
// No `import "server-only"` guard here (or in auth.ts/data.ts): that marker
// throws unconditionally unless the bundler sets the "react-server"
// condition, and it turns out to do so inconsistently — it broke this
// module's own vitest run, which resolves the package's plain Node
// "default" export. Never imported from a Client Component regardless, so
// the guard was only ever a defense-in-depth extra, not load-bearing.

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, hashHex] = storedHash.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;

  const candidate = crypto.scryptSync(password, salt, KEY_LENGTH);
  const stored = Buffer.from(hashHex, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

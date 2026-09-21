import { describe, expect, it } from "vitest";
import { createSessionPayload, decodeSession, encodeSession } from "./session-token";

describe("session tokens", () => {
  it("round-trips a valid session", () => {
    const payload = createSessionPayload("coach_1", "COACH");
    const token = encodeSession(payload);
    expect(decodeSession(token)).toEqual(payload);
  });

  it("rejects a tampered payload", () => {
    const token = encodeSession(createSessionPayload("coach_1", "COACH"));
    const [, signature] = token.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ sub: "coach_2", role: "COACH", exp: 9999999999 })).toString(
      "base64url",
    );
    expect(decodeSession(`${tamperedBody}.${signature}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const expired = { sub: "coach_1", role: "COACH" as const, exp: Math.floor(Date.now() / 1000) - 10 };
    expect(decodeSession(encodeSession(expired))).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("not-a-token")).toBeNull();
    expect(decodeSession("a.b")).toBeNull();
  });
});

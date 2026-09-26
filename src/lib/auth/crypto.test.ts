import { describe, expect, it } from "vitest";

import {
  createManagerPasswordHash,
  createManagerSessionToken,
  verifyManagerPassword,
  verifyManagerSessionToken,
} from "./crypto";

describe("manager password hash", () => {
  it("accepts the original password and rejects another password", async () => {
    const hash = await createManagerPasswordHash("correct horse", Buffer.alloc(16, 7));

    await expect(verifyManagerPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyManagerPassword("wrong horse", hash)).resolves.toBe(false);
  });

  it("rejects malformed hashes without throwing", async () => {
    await expect(verifyManagerPassword("password", "not-a-scrypt-hash")).resolves.toBe(false);
  });
});

describe("manager session token", () => {
  const secret = "a-long-random-session-secret-for-tests";
  const now = Date.UTC(2026, 8, 26, 12);

  it("accepts a correctly signed token before expiry", () => {
    const token = createManagerSessionToken(secret, now);

    expect(verifyManagerSessionToken(token, secret, now + 60_000)).toBe(true);
  });

  it("rejects expired and tampered tokens", () => {
    const token = createManagerSessionToken(secret, now);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifyManagerSessionToken(token, secret, now + 10 * 60 * 60 * 1_000)).toBe(false);
    expect(verifyManagerSessionToken(tampered, secret, now + 1_000)).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifyManagerSessionToken("not-a-token", secret, now)).toBe(false);
  });
});

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./token-crypto";

function legacyEncrypt(value: string, keySource: string) {
  const key = createHash("sha256").update(keySource).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

describe("token encryption helpers", () => {
  beforeEach(() => {
    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "test-token-key";
    delete process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  it("round-trips encrypted secrets", () => {
    const token = "ya29.a0AfH6SMBexample";
    const encrypted = encryptSecret(token);
    const decrypted = decryptSecret(encrypted);

    expect(encrypted).not.toBe(token);
    expect(encrypted.startsWith("v1.k0.")).toBe(true);
    expect(decrypted).toBe(token);
  });

  it("rejects tampered encrypted payloads", () => {
    const token = "refresh_token_example";
    const encrypted = encryptSecret(token);
    const tampered = `${encrypted.slice(0, -3)}abc`;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("decrypts legacy payloads without version prefix", () => {
    const token = "legacy-token";
    const encrypted = legacyEncrypt(token, "test-token-key");

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(token);
  });

  it("decrypts payloads using previous key fallback", () => {
    const token = "fallback-token";
    const encryptedWithOldKey = legacyEncrypt(token, "previous-token-key");

    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "new-token-key";
    process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS = "previous-token-key";
    const decrypted = decryptSecret(encryptedWithOldKey);
    expect(decrypted).toBe(token);
  });
});

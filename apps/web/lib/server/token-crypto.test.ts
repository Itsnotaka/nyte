import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./token-crypto";

describe("token encryption helpers", () => {
  beforeEach(() => {
    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "test-token-key";
  });

  it("round-trips encrypted secrets", () => {
    const token = "ya29.a0AfH6SMBexample";
    const encrypted = encryptSecret(token);
    const decrypted = decryptSecret(encrypted);

    expect(encrypted).not.toBe(token);
    expect(decrypted).toBe(token);
  });

  it("rejects tampered encrypted payloads", () => {
    const token = "refresh_token_example";
    const encrypted = encryptSecret(token);
    const tampered = `${encrypted.slice(0, -3)}abc`;

    expect(() => decryptSecret(tampered)).toThrow();
  });
});

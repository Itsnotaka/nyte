import { afterEach, describe, expect, it } from "vitest";

import { getAuthSecret, getTokenEncryptionKeySource } from "./runtime-secrets";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthSecret = process.env.BETTER_AUTH_SECRET;
const originalTokenKey = process.env.NYTE_TOKEN_ENCRYPTION_KEY;
const originalNextPhase = process.env.NEXT_PHASE;

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

describe("runtime secret helpers", () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
    if (originalAuthSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = originalAuthSecret;
    }
    if (originalTokenKey === undefined) {
      delete process.env.NYTE_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.NYTE_TOKEN_ENCRYPTION_KEY = originalTokenKey;
    }
    if (originalNextPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = originalNextPhase;
    }
  });

  it("uses configured BETTER_AUTH_SECRET when available", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PHASE;
    process.env.BETTER_AUTH_SECRET = "configured-secret";

    const secret = getAuthSecret();
    expect(secret.value).toBe("configured-secret");
    expect(secret.source).toBe("env");
  });

  it("throws in production when BETTER_AUTH_SECRET is missing", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PHASE;
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => getAuthSecret()).toThrow("BETTER_AUTH_SECRET is required in production.");
  });

  it("falls back to dev secret in non-production", () => {
    setNodeEnv("development");
    delete process.env.NEXT_PHASE;
    delete process.env.BETTER_AUTH_SECRET;

    const secret = getAuthSecret();
    expect(secret.source).toBe("dev-fallback");
    expect(secret.value.length).toBeGreaterThan(10);
  });

  it("reports token key source", () => {
    delete process.env.NYTE_TOKEN_ENCRYPTION_KEY;
    expect(getTokenEncryptionKeySource()).toBe("dev-fallback");

    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "configured-token-key";
    expect(getTokenEncryptionKeySource()).toBe("env");
  });

  it("allows fallback during production build phase", () => {
    setNodeEnv("production");
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.BETTER_AUTH_SECRET;

    const secret = getAuthSecret();
    expect(secret.source).toBe("dev-fallback");
  });
});

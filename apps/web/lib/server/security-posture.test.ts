import { describe, expect, it } from "vitest";

import { evaluateSecurityPosture } from "./security-posture";

describe("evaluateSecurityPosture", () => {
  it("returns warning posture when authz or secrets are not fully hardened", () => {
    const posture = evaluateSecurityPosture({
      security: {
        authzEnforced: false,
        authSecretConfigured: false,
        authSecretSource: "dev-fallback",
        tokenEncryptionKeyConfigured: false,
        tokenEncryptionKeySource: "dev-fallback",
        hasPreviousTokenKey: false,
        rateLimitMode: "auto",
        rateLimitProvider: "memory",
        unkeyRateLimitConfigured: false,
      },
      googleConnection: {
        connected: false,
        provider: "google",
        providerAccountId: null,
        scopes: [],
        connectedAt: null,
        updatedAt: null,
      },
    });

    expect(posture.status).toBe("warning");
    expect(posture.warnings.length).toBeGreaterThan(1);
  });

  it("returns ok posture when security checks pass", () => {
    const posture = evaluateSecurityPosture({
      security: {
        authzEnforced: true,
        authSecretConfigured: true,
        authSecretSource: "env",
        tokenEncryptionKeyConfigured: true,
        tokenEncryptionKeySource: "env",
        hasPreviousTokenKey: true,
        rateLimitMode: "auto",
        rateLimitProvider: "unkey",
        unkeyRateLimitConfigured: true,
      },
      googleConnection: {
        connected: true,
        provider: "google",
        providerAccountId: "acct_123",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        connectedAt: "2026-01-20T12:00:00.000Z",
        updatedAt: "2026-01-20T12:00:00.000Z",
      },
    });

    expect(posture.status).toBe("ok");
    expect(posture.warnings).toHaveLength(0);
  });

  it("warns when Unkey root key is not configured", () => {
    const posture = evaluateSecurityPosture({
      security: {
        authzEnforced: true,
        authSecretConfigured: true,
        authSecretSource: "env",
        tokenEncryptionKeyConfigured: true,
        tokenEncryptionKeySource: "env",
        hasPreviousTokenKey: true,
        rateLimitMode: "auto",
        rateLimitProvider: "memory",
        unkeyRateLimitConfigured: false,
      },
      googleConnection: {
        connected: true,
        provider: "google",
        providerAccountId: "acct_123",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        connectedAt: "2026-01-20T12:00:00.000Z",
        updatedAt: "2026-01-20T12:00:00.000Z",
      },
    });

    expect(posture.status).toBe("warning");
    expect(posture.warnings).toContain(
      "UNKEY_ROOT_KEY is not configured; using in-process fallback rate limiter.",
    );
  });

  it("warns when unkey mode is forced without key", () => {
    const posture = evaluateSecurityPosture({
      security: {
        authzEnforced: true,
        authSecretConfigured: true,
        authSecretSource: "env",
        tokenEncryptionKeyConfigured: true,
        tokenEncryptionKeySource: "env",
        hasPreviousTokenKey: true,
        rateLimitMode: "unkey",
        rateLimitProvider: "memory",
        unkeyRateLimitConfigured: false,
      },
      googleConnection: {
        connected: true,
        provider: "google",
        providerAccountId: "acct_123",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        connectedAt: "2026-01-20T12:00:00.000Z",
        updatedAt: "2026-01-20T12:00:00.000Z",
      },
    });

    expect(posture.status).toBe("warning");
    expect(posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to unkey but UNKEY_ROOT_KEY is not configured.",
    );
  });
});

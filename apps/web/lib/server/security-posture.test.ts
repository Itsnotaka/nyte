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
});

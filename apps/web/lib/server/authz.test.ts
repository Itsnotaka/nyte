import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, requireAuthorizedSessionOr401, shouldEnforceAuthz } from "./authz";

const originalNodeEnv = process.env.NODE_ENV;
const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

describe("shouldEnforceAuthz", () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
    } else {
      process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    }
  });

  it("enforces authz in production", () => {
    setNodeEnv("production");
    delete process.env.NYTE_REQUIRE_AUTH;
    expect(shouldEnforceAuthz()).toBe(true);
  });

  it("allows explicit authz requirement in non-production", () => {
    setNodeEnv("development");
    process.env.NYTE_REQUIRE_AUTH = "true";
    expect(shouldEnforceAuthz()).toBe(true);
  });

  it("does not enforce authz by default in non-production", () => {
    setNodeEnv("development");
    delete process.env.NYTE_REQUIRE_AUTH;
    expect(shouldEnforceAuthz()).toBe(false);
  });
});

describe("requireAuthorizedSessionOr401", () => {
  const request = new Request("http://localhost/api/dashboard");

  it("returns null when authorization succeeds", async () => {
    const response = await requireAuthorizedSessionOr401(request, vi.fn().mockResolvedValue({}));

    expect(response).toBeNull();
  });

  it("returns 401 response on authorization errors", async () => {
    const response = await requireAuthorizedSessionOr401(
      request,
      vi.fn().mockRejectedValue(new AuthorizationError("Authentication required.")),
    );
    const body = (await response?.json()) as { error: string };

    expect(response).toBeDefined();
    expect(response?.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });

  it("rethrows non-authorization failures", async () => {
    const failure = new Error("session provider unavailable");

    await expect(
      requireAuthorizedSessionOr401(request, vi.fn().mockRejectedValue(failure)),
    ).rejects.toThrow("session provider unavailable");
  });
});

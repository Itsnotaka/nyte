import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthorizationError,
  AuthorizationServiceError,
  createAuthorizationErrorResponse,
  requireAuthorizedSession,
  shouldEnforceAuthz,
} from "./authz";

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

describe("requireAuthorizedSession", () => {
  const request = new Request("http://localhost/api/dashboard");

  it("returns ok when authorization succeeds", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const result = await requireAuthorizedSession(request, vi.fn().mockResolvedValue({}));

    expect(result.isOk()).toBe(true);
  });

  it("returns unauthorized error when session is missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const result = await requireAuthorizedSession(request, vi.fn().mockResolvedValue(null));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AuthorizationError);
    }
  });

  it("returns service error when provider call fails", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const result = await requireAuthorizedSession(
      request,
      vi.fn().mockRejectedValue(new Error("session provider unavailable")),
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AuthorizationServiceError);
    }
  });
});

describe("createAuthorizationErrorResponse", () => {
  it("returns 401 payload for authorization failures", async () => {
    const response = createAuthorizationErrorResponse(
      new AuthorizationError("Authentication required."),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });

  it("returns 500 payload for provider failures", async () => {
    const response = createAuthorizationErrorResponse(
      new AuthorizationServiceError("Failed to resolve authenticated session."),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toContain("Failed to validate authorization");
  });
});

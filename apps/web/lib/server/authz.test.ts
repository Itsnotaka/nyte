import { afterEach, describe, expect, it } from "vitest";

import { shouldEnforceAuthz } from "./authz";

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

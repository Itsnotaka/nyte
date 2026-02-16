import { afterEach, describe, expect, it } from "vitest";

import {
  createRuntimeCommandContext,
  runtimeErrorStatus,
  shouldDelegateRuntimeCommand,
} from "./runtime-delegation";

const originalSyncFlag = process.env.NYTE_RUNTIME_DELEGATE_SYNC;

afterEach(() => {
  if (originalSyncFlag === undefined) {
    delete process.env.NYTE_RUNTIME_DELEGATE_SYNC;
    return;
  }

  process.env.NYTE_RUNTIME_DELEGATE_SYNC = originalSyncFlag;
});

describe("shouldDelegateRuntimeCommand", () => {
  it("returns true for trimmed true values", () => {
    process.env.NYTE_RUNTIME_DELEGATE_SYNC = " TrUe ";

    expect(shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_SYNC")).toBe(true);
  });

  it("returns false when flag is missing or non-true", () => {
    delete process.env.NYTE_RUNTIME_DELEGATE_SYNC;
    expect(shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_SYNC")).toBe(false);

    process.env.NYTE_RUNTIME_DELEGATE_SYNC = "yes";
    expect(shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_SYNC")).toBe(false);
  });
});

describe("runtimeErrorStatus", () => {
  it("maps runtime error codes to expected status values", () => {
    expect(runtimeErrorStatus("bad_request")).toBe(400);
    expect(runtimeErrorStatus("unauthorized")).toBe(401);
    expect(runtimeErrorStatus("not_found")).toBe(404);
    expect(runtimeErrorStatus("conflict")).toBe(409);
    expect(runtimeErrorStatus("internal")).toBe(500);
  });
});

describe("createRuntimeCommandContext", () => {
  it("builds deterministic context when options are provided", () => {
    const context = createRuntimeCommandContext({
      userId: "user_123",
      requestId: "req_123",
      now: new Date("2026-02-16T12:00:00.000Z"),
    });

    expect(context).toEqual({
      userId: "user_123",
      requestId: "req_123",
      source: "web",
      issuedAt: "2026-02-16T12:00:00.000Z",
    });
  });
});

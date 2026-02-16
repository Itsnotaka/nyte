import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "./security-headers";

describe("applySecurityHeaders", () => {
  it("applies baseline security headers for all responses", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { isApiRoute: false });

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cache-Control")).toBeNull();
  });

  it("adds no-store cache headers for API responses", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { isApiRoute: true });

    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Pragma")).toBe("no-cache");
  });
});

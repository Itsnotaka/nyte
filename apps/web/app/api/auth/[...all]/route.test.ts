import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("auth catch-all route", () => {
  it("handles unsupported GET auth path without crashing", async () => {
    const response = await GET(
      new Request("http://localhost/api/auth/unsupported", {
        method: "GET",
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("handles unsupported POST auth path without crashing", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/unsupported", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

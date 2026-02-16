import path from "node:path";
import os from "node:os";

import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl } from "@nyte/db/client";

describe("resolveDatabaseUrl", () => {
  it("defaults to temp sqlite file when DATABASE_URL is absent", () => {
    const resolved = resolveDatabaseUrl(undefined);

    expect(resolved).toBe(`file:${path.join(os.tmpdir(), "nyte-dev.sqlite")}`);
  });

  it("resolves relative file paths into file: URLs", () => {
    const resolved = resolveDatabaseUrl("./data/nyte.sqlite");

    expect(resolved).toBe(`file:${path.resolve("./data/nyte.sqlite")}`);
  });

  it("preserves explicit file URL values", () => {
    const resolved = resolveDatabaseUrl("file:/tmp/custom.sqlite");

    expect(resolved).toBe("file:/tmp/custom.sqlite");
  });

  it("preserves remote libsql urls for hosted runtime setups", () => {
    const resolved = resolveDatabaseUrl("libsql://nyte-primary.turso.io");

    expect(resolved).toBe("libsql://nyte-primary.turso.io");
  });

  it("preserves non-file scheme urls and trims whitespace", () => {
    const resolved = resolveDatabaseUrl("  https://db.example.com/nyte  ");

    expect(resolved).toBe("https://db.example.com/nyte");
  });
});

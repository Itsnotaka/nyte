import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd();
const TARGET_DIRECTORIES = [join(APP_ROOT, "app/api"), join(APP_ROOT, "lib/server")];
const TARGET_FILES = [join(APP_ROOT, "components/nyte-shell.tsx")];

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(absolutePath));
      continue;
    }

    const isSourceFile = absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx");
    const isTestFile = absolutePath.endsWith(".test.ts") || absolutePath.endsWith(".test.tsx");
    if (!isSourceFile || isTestFile) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function readRuntimeSourceFiles() {
  const files = TARGET_DIRECTORIES.flatMap((directory) => listSourceFiles(directory));
  return [...files, ...TARGET_FILES].map((path) => ({
    path,
    source: readFileSync(path, "utf8"),
  }));
}

describe("architecture contract", () => {
  it("keeps runtime API/server/UI flows free from try/catch blocks", () => {
    const filesWithTryCatch = readRuntimeSourceFiles()
      .filter(({ source }) => /\btry\s*\{|\bcatch\s*\(/.test(source))
      .map(({ path }) => path);

    expect(filesWithTryCatch).toEqual([]);
  });

  it("avoids custom Better/V2/V3 helper naming in runtime sources", () => {
    const forbiddenDeclarationPattern =
      /\b(?:function|const|class|type|interface)\s+(?:Better[A-Z]\w*|\w*(?:V2|v2|V3|v3))\b/g;
    const offenders = readRuntimeSourceFiles()
      .flatMap(({ path, source }) => {
        const matches = Array.from(source.matchAll(forbiddenDeclarationPattern)).map(
          (match) => `${path}: ${match[0]}`,
        );
        return matches;
      })
      .sort();

    expect(offenders).toEqual([]);
  });
});

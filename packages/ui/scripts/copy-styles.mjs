import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceFile = join(__dirname, "..", "..", "..", "tooling", "tailwind", "theme.css");
const targetDirectory = join(__dirname, "..", "dist", "styles");
const targetFile = join(targetDirectory, "theme.css");

if (!existsSync(targetDirectory)) {
  mkdirSync(targetDirectory, { recursive: true });
}

cpSync(sourceFile, targetFile);

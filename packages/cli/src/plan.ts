import path from "node:path";

export type Plan =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "run"; args: string[] }
  | { kind: "git"; args: string[]; cwd: string; announce: boolean };

const known = new Set([
  "init",
  "create",
  "submit",
  "modify",
  "restack",
  "sync",
  "checkout",
  "log",
  "up",
  "down",
  "guide",
]);

const root_help = new Set(["-h", "--help"]);
const root_version = new Set(["-v", "--version"]);
const root_flag = new Set([
  "--debug",
  "--interactive",
  "--no-interactive",
  "--verify",
  "--no-verify",
  "-q",
  "--quiet",
]);

const quiet_in_root_prefix = (raw: string[]): boolean => {
  const scan = (idx: number): boolean => {
    const arg = raw[idx];

    if (arg === undefined) {
      return false;
    }

    if (arg === "--cwd") {
      return scan(idx + 2);
    }

    if (arg.startsWith("--cwd=")) {
      return scan(idx + 1);
    }

    if (arg === "-q" || arg === "--quiet") {
      return true;
    }

    if (root_flag.has(arg) || root_help.has(arg) || root_version.has(arg)) {
      return scan(idx + 1);
    }

    return arg.startsWith("-") ? scan(idx + 1) : false;
  };

  return scan(0);
};

export const argv = (raw: string[]): Plan => {
  const first = (): string | null => {
    const scan = (idx: number): string | null => {
      const arg = raw[idx];

      if (arg === undefined) {
        return null;
      }

      if (arg === "--cwd") {
        return scan(idx + 2);
      }

      if (arg.startsWith("--cwd=")) {
        return scan(idx + 1);
      }

      if (root_flag.has(arg) || root_help.has(arg) || root_version.has(arg)) {
        return scan(idx + 1);
      }

      return arg.startsWith("-") ? scan(idx + 1) : arg;
    };

    return scan(0);
  };

  const cwd = (): string => {
    const idx = raw.findIndex((arg) => arg === "--cwd" || arg.startsWith("--cwd="));

    if (idx === -1) {
      return process.cwd();
    }

    const arg = raw[idx];
    return path.resolve(arg === "--cwd" ? (raw[idx + 1] ?? process.cwd()) : arg.slice(6));
  };

  const strip = (): string[] => {
    const step = (idx: number, seen: boolean, out: string[]): string[] => {
      const arg = raw[idx];

      if (arg === undefined) {
        return out;
      }

      if (!seen && arg === "--cwd") {
        return step(idx + 2, seen, out);
      }

      if (!seen && arg.startsWith("--cwd=")) {
        return step(idx + 1, seen, out);
      }

      if (!seen && root_flag.has(arg)) {
        return step(idx + 1, seen, out);
      }

      if (!seen && arg.startsWith("-")) {
        return step(idx + 1, seen, [...out, arg]);
      }

      return step(idx + 1, seen || !arg.startsWith("-"), [...out, arg]);
    };

    return step(0, false, []);
  };

  const name = first();

  if (name === null) {
    return raw.some((arg) => root_version.has(arg)) ? { kind: "version" } : { kind: "help" };
  }

  if (known.has(name)) {
    return { kind: "run", args: raw };
  }

  return {
    kind: "git",
    args: strip(),
    cwd: cwd(),
    announce: !quiet_in_root_prefix(raw),
  };
};

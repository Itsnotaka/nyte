import { spawnSync } from "node:child_process";

export const call = (args: string[], cwd: string, stdio: "inherit" | "pipe" = "pipe") => {
  const out = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio,
  });

  if (out.error) {
    throw out.error;
  }

  return out;
};

export const code = (status: number | null) => status ?? 1;

export const git_branch = (cwd: string) => {
  const out = call(["branch", "--show-current"], cwd);
  return out.status === 0 ? out.stdout.trim() : null;
};

export const switch_to = (cwd: string, name: string) =>
  code(call(["switch", name], cwd, "inherit").status);

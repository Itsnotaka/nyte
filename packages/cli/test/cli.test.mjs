import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const originalPath = process.env.PATH;
const env = {
  ...process.env,
  NO_COLOR: "1",
  GIT_PAGER: "cat",
  PAGER: "cat",
  MANPAGER: "cat",
};

const run = (...args) =>
  spawnSync("pnpm", ["exec", "tsx", "src/index.ts", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: originalPath,
      NO_COLOR: "1",
      GIT_PAGER: "cat",
      PAGER: "cat",
      MANPAGER: "cat",
    },
  });

const git = (cwd, ...args) => {
  const out = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env,
  });

  assert.equal(out.status, 0, out.stderr);
};

const repo = () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "sachi-cli-"));

  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.name", "sachi");
  git(cwd, "config", "user.email", "sachi@example.com");
  writeFileSync(path.join(cwd, "README.md"), "# repo\n");
  git(cwd, "add", "README.md");
  git(cwd, "commit", "-m", "init");

  return cwd;
};

const shim = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sachi-cli-git-"));
  const bin = path.join(dir, "bin");
  const out = path.join(dir, "args.txt");

  mkdirSync(bin);
  writeFileSync(
    path.join(bin, "git"),
    ["#!/bin/sh", `printf '%s\\n' \"$@\" > ${JSON.stringify(out)}`, "exit 0", ""].join("\n"),
  );
  chmodSync(path.join(bin, "git"), 0o755);

  return { bin, out };
};

test("help, version, guide, passthrough, stack flow", () => {
  const help = run("--help");

  assert.equal(help.status, 0);
  assert.match(help.stdout, /USAGE/);
  assert.match(help.stdout, /TERMS/);
  assert.match(help.stdout, /CORE COMMANDS/);
  assert.match(help.stdout, /CORE WORKFLOW/);
  assert.match(help.stdout, /LEARN MORE/);
  assert.match(help.stdout, /FLAGS/);

  const init_help = run("init", "--help");

  assert.equal(init_help.status, 0);
  assert.match(init_help.stdout, /--trunk/);

  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const ver = run("--version");

  assert.equal(ver.status, 0);
  assert.equal(ver.stdout.trim(), pkg.version);

  const guide = run("guide", "workflow");

  assert.equal(guide.status, 0);
  assert.match(guide.stdout, /Initialize the repo with sachi init/);

  const fake = shim();
  const pass = spawnSync("pnpm", ["exec", "tsx", "src/index.ts", "frob", "--x"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...env,
      PATH: `${fake.bin}:${process.env.PATH}`,
    },
  });

  assert.equal(pass.status, 0);
  assert.equal(readFileSync(fake.out, "utf8").trim(), "frob\n--x");
  assert.match(pass.stdout, /Passing command through to git/);
  assert.match(pass.stdout, /Running: "git frob --x"/);
  const quiet_pass = spawnSync("pnpm", ["exec", "tsx", "src/index.ts", "-q", "frob", "--x"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...env,
      PATH: `${fake.bin}:${process.env.PATH}`,
    },
  });

  assert.equal(quiet_pass.status, 0);
  assert.equal(readFileSync(fake.out, "utf8").trim(), "frob\n--x");
  assert.doesNotMatch(quiet_pass.stdout, /Passing command through to git/);
  assert.doesNotMatch(quiet_pass.stdout, /Running:/);
  const cwd = repo();
  const init = run("--cwd", cwd, "init");

  assert.equal(init.status, 0, init.stderr);
  assert.ok(existsSync(path.join(cwd, ".git", "sachi", "stack.json")));

  const first = run("--cwd", cwd, "log");

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), "◉ main");

  git(cwd, "switch", "-c", "feat/base");
  git(cwd, "switch", "-c", "feat/ui");
  git(cwd, "switch", "main");
  git(cwd, "branch", "feat/docs");
  git(cwd, "switch", "feat/ui");
  writeFileSync(
    path.join(cwd, ".git", "sachi", "stack.json"),
    `${JSON.stringify(
      {
        trunk: "main",
        branches: {
          main: { parent: null, children: [] },
          "feat/base": { parent: "main", children: [] },
          "feat/ui": { parent: "feat/base", children: [] },
          "feat/docs": { parent: "main", children: [] },
        },
      },
      null,
      2,
    )}\n`,
  );

  const tree = run("--cwd", cwd, "log");

  assert.equal(tree.status, 0, tree.stderr);
  assert.equal(
    tree.stdout.trim(),
    ["◯ main", "│", "├◯ feat/base", "│ └◉ feat/ui", "└◯ feat/docs"].join("\n"),
  );

  git(cwd, "switch", "main");
  const up = run("--cwd", cwd, "up");

  assert.equal(up.status, 1);
  assert.match(up.stderr, /Multiple upstack branches are tracked above main/);

  writeFileSync(
    path.join(cwd, ".git", "sachi", "stack.json"),
    `${JSON.stringify(
      {
        trunk: "main",
        branches: {
          main: { parent: null, children: [] },
        },
      },
      null,
      2,
    )}\n`,
  );

  const no_up = run("--cwd", cwd, "up");
  const no_down = run("--cwd", cwd, "down");

  assert.equal(no_up.status, 1);
  assert.match(no_up.stderr, /No upstack branch is tracked above main/);
  assert.equal(no_down.status, 1);
  assert.match(no_down.stderr, /No downstack branch is tracked below main/);

  const stub = run("submit");

  assert.equal(stub.status, 0);
  assert.match(stub.stdout, /Submission is planned for a later milestone/);
});

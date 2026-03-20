import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { styleText } from "node:util";

import type { CommandModule } from "yargs";
import yargs from "yargs/yargs";

type Args = {
  cwd: string;
  debug: boolean;
  interactive: boolean;
  verify: boolean;
  quiet: boolean;
};

type Node = {
  parent: string | null;
  children: string[];
};

type Stack = {
  trunk: string;
  branches: Record<string, Node>;
};

type Plan =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "run"; args: string[] }
  | { kind: "git"; args: string[]; cwd: string };

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

const tint = (fmt: Parameters<typeof styleText>[0], text: string) =>
  Boolean(process.stdout.isTTY) &&
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== "0" &&
  process.env.TERM !== "dumb"
    ? styleText(fmt, text, { validateStream: false })
    : text;

const dim = (text: string) => tint("dim", text);
const muted = (text: string) => tint(["gray", "dim"], text);
const err = (text: string) => tint("red", text);
const warn = (text: string) => tint("yellow", text);
const ok = (text: string) => tint("green", text);
const info = (text: string) => tint("cyan", text);
const cmd = (text: string) => tint("cyan", text);
const branch = (text: string) => tint("cyan", text);
const current = (text: string) => tint(["cyan", "bold"], text);
const hint = (text: string) => tint(["gray", "dim"], text);

const say = (text: string) => {
  process.stdout.write(`${text}\n`);
};

const note = (text: string) => {
  process.stdout.write(`${info(text)}\n`);
};

const fail = (text: string) => {
  process.stderr.write(`${err(text)}\n`);
  process.exitCode = 1;
};

const version = () =>
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

const call = (args: string[], cwd: string, stdio: "inherit" | "pipe" = "pipe") => {
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

const code = (status: number | null) => status ?? 1;

const git_branch = (cwd: string) => {
  const out = call(["branch", "--show-current"], cwd);
  return out.status === 0 ? out.stdout.trim() : null;
};

const switch_to = (cwd: string, name: string) =>
  code(call(["switch", name], cwd, "inherit").status);

const obj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const is_node = (value: unknown): value is Node =>
  obj(value) &&
  (typeof value.parent === "string" || value.parent === null) &&
  Array.isArray(value.children);

const file = (cwd: string) => {
  const out = call(["rev-parse", "--path-format=absolute", "--git-dir"], cwd);
  const dir = out.status === 0 ? out.stdout.trim() : null;
  return dir ? path.join(dir, "sachi", "stack.json") : null;
};

const normalize = (stack: Stack) => {
  const trunk = stack.trunk || "main";
  const branches = Object.entries(stack.branches)
    .filter(([name, node]) => name.length > 0 && is_node(node))
    .reduce<Record<string, Node>>(
      (acc, [name, node]) => ({
        ...acc,
        [name]: {
          parent: node.parent,
          children: [],
        },
      }),
      {},
    );

  const next = {
    trunk,
    branches: {
      ...branches,
      [trunk]: {
        parent: null,
        children: [],
      },
    },
  };

  Object.entries(next.branches).forEach(([name, node]) => {
    if (node.parent === null) {
      return;
    }

    const up = next.branches[node.parent];

    if (!up) {
      throw new Error(`Tracked branch ${name} points to unknown parent ${node.parent}.`);
    }

    next.branches[node.parent] = {
      ...up,
      children: [...up.children, name].sort(),
    };
  });

  if (!next.trunk) {
    throw new Error("Stack metadata is missing a trunk branch.");
  }

  const head = next.branches[next.trunk];

  if (!head) {
    throw new Error(`Trunk branch ${next.trunk} is not tracked.`);
  }

  if (head.parent !== null) {
    throw new Error(`Trunk branch ${next.trunk} must not have a parent.`);
  }

  const visit = (name: string, path: Set<string>, seen: Set<string>): Set<string> => {
    if (path.has(name)) {
      throw new Error(`Stack metadata contains a cycle at ${name}.`);
    }

    if (seen.has(name)) {
      return seen;
    }

    return next.branches[name].children.reduce(
      (acc, child) => visit(child, new Set([...path, name]), acc),
      new Set([...seen, name]),
    );
  };

  const seen = visit(next.trunk, new Set(), new Set());
  const miss = Object.keys(next.branches).filter((name) => !seen.has(name));

  if (miss.length > 0) {
    throw new Error(`Stack metadata contains unreachable branches: ${miss.join(", ")}.`);
  }

  Object.entries(next.branches).forEach(([name, node]) => {
    if (name === next.trunk) {
      return;
    }

    if (node.parent === null) {
      throw new Error(`Tracked branch ${name} is missing a parent.`);
    }

    if (!next.branches[node.parent]) {
      throw new Error(`Tracked branch ${name} points to unknown parent ${node.parent}.`);
    }
  });

  return next;
};

const parse = (text: string) => {
  const value = JSON.parse(text) as unknown;

  if (!obj(value)) {
    throw new Error("Stack metadata must be a JSON object.");
  }

  if (typeof value.trunk !== "string") {
    throw new Error("Stack metadata must include a string trunk field.");
  }

  if (!obj(value.branches)) {
    throw new Error("Stack metadata must include a branches map.");
  }

  return normalize({
    trunk: value.trunk,
    branches: Object.entries(value.branches).reduce<Record<string, Node>>(
      (acc, [name, node]) => ({
        ...acc,
        [name]: is_node(node)
          ? {
              parent: node.parent,
              children: node.children.filter((child): child is string => typeof child === "string"),
            }
          : {
              parent: null,
              children: [],
            },
      }),
      {},
    ),
  });
};

const read = (cwd: string) => {
  const name = file(cwd);

  if (!name) {
    throw new Error("Not inside a git repository.");
  }

  if (!existsSync(name)) {
    throw new Error("sachi is not initialized in this repo. Run `sachi init` first.");
  }

  return parse(readFileSync(name, "utf8"));
};

const write = (cwd: string, stack: Stack) => {
  const name = file(cwd);

  if (!name) {
    throw new Error("Not inside a git repository.");
  }

  mkdirSync(path.dirname(name), { recursive: true });
  writeFileSync(name, `${JSON.stringify(normalize(stack), null, 2)}\n`);
};

const has = (stack: Stack, name: string) => stack.branches[name] !== undefined;
const parent = (stack: Stack, name: string) => stack.branches[name]?.parent ?? null;
const children = (stack: Stack, name: string) => stack.branches[name]?.children ?? [];
const tracked = (stack: Stack, name: string | null) => (name && has(stack, name) ? name : null);

const argv = (raw: string[]): Plan => {
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
  };
};

type Mod<T = Args> = CommandModule<Args, T>;

const stub = (name: string, describe: string, text: string, git?: string): Mod => ({
  command: name,
  describe,
  handler() {
    note(text);

    if (!git) {
      return;
    }

    say(hint(`Raw fallback: ${cmd(git)}`));
  },
});

type Init = Args & {
  trunk: string;
};

const init: CommandModule<Args, Init> = {
  command: "init",
  describe: "Create local stack metadata for this repo.",
  builder: (y) =>
    y.option("trunk", {
      type: "string",
      default: "main",
      describe: "Name of the trunk branch to track.",
    }),
  handler(argv) {
    if (call(["rev-parse", "--show-toplevel"], argv.cwd).status !== 0) {
      fail("sachi init must run inside a git repository.");
      return;
    }

    const now = git_branch(argv.cwd);

    if (!now) {
      fail("Cannot initialize stack metadata from a detached HEAD.");
      return;
    }

    write(argv.cwd, {
      trunk: argv.trunk,
      branches: {
        [argv.trunk]: {
          parent: null,
          children: [],
        },
      },
    });

    note(`${ok("Initialized")} local stack metadata for ${branch(argv.trunk)}.`);

    if (now !== argv.trunk) {
      note(
        `Current branch ${branch(now)} is not tracked yet. Start from ${cmd("sachi create")} later.`,
      );
    }
  },
};

const log: Mod = {
  command: "log",
  describe: "Show the tracked stack tree.",
  handler(argv) {
    const stack = read(argv.cwd);
    const head = tracked(stack, git_branch(argv.cwd));
    const refs = call(["for-each-ref", "--format=%(refname:short)", "refs/heads"], argv.cwd);
    const disk =
      refs.status === 0
        ? refs.stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : [];
    const names = new Set(disk);

    const leaf = (name: string, tip: string | null, miss?: Set<string>) => {
      const gone = miss ? !miss.has(name) : false;
      const mark = name === tip ? "◉" : "◯";
      const body = name === tip ? current(name) : branch(name);
      return gone ? `${warn(`${mark} ${name}`)} ${muted("(missing)")}` : `${mark} ${body}`;
    };

    const walk = (
      s: Stack,
      tip: string | null,
      miss: Set<string> | undefined,
      name: string,
      pre: string,
    ): string[] =>
      s.branches[name].children.flatMap((child, idx, list) => {
        const last = idx === list.length - 1;
        const line = `${pre}${last ? "└" : "├"}${leaf(child, tip, miss)}`;
        const next = `${pre}${last ? "  " : "│ "}`;
        return [line, ...walk(s, tip, miss, child, next)];
      });

    const lines = (() => {
      const top = [leaf(stack.trunk, head, names)];
      const body =
        stack.branches[stack.trunk].children.length === 0
          ? []
          : ["│", ...walk(stack, head, names, stack.trunk, "")];
      return [...top, ...body];
    })();

    say(lines.join("\n"));
  },
};

const up: Mod = {
  command: "up",
  describe: "Move to a unique child branch.",
  handler(argv) {
    const stack = read(argv.cwd);
    const now = tracked(stack, git_branch(argv.cwd));

    if (!now) {
      fail("Current branch is not tracked in the local stack.");
      return;
    }

    const list = children(stack, now);

    if (list.length === 0) {
      fail(`No upstack branch is tracked above ${branch(now)}.`);
      return;
    }

    if (list.length > 1) {
      fail(`Multiple upstack branches are tracked above ${branch(now)}.`);
      say(list.map((name) => `- ${branch(name)}`).join("\n"));
      return;
    }

    note(`Switching to ${branch(list[0])}.`);
    process.exitCode = switch_to(argv.cwd, list[0]);
  },
};

const down: Mod = {
  command: "down",
  describe: "Move to the parent branch.",
  handler(argv) {
    const stack = read(argv.cwd);
    const now = tracked(stack, git_branch(argv.cwd));

    if (!now) {
      fail("Current branch is not tracked in the local stack.");
      return;
    }

    const up = parent(stack, now);

    if (!up) {
      fail(`No downstack branch is tracked below ${branch(now)}.`);
      return;
    }

    note(`Switching to ${branch(up)}.`);
    process.exitCode = switch_to(argv.cwd, up);
  },
};

const guide: Mod = {
  command: "guide",
  describe: "Print workflow guidance.",
  builder: (y) =>
    y
      .command({
        command: "workflow",
        describe: "Show the basic stacked-branch workflow.",
        handler() {
          say(
            [
              `${info("Workflow Guide")}`,
              "",
              `1. Initialize the repo with ${cmd("sachi init")}.`,
              `2. Track the trunk branch, usually ${cmd("sachi init --trunk main")}.`,
              `3. Create the first stacked branch on top of trunk.`,
              `4. Create a child branch on top of that first branch.`,
              `5. Inspect the result with ${cmd("sachi log")}.`,
              `6. Restack after base changes with ${cmd("sachi restack")}.`,
              `7. Submit later when the workflow grows past milestone 1.`,
            ].join("\n"),
          );
        },
      })
      .demandCommand(1),
  handler() {},
};

const boot = () =>
  yargs()
    .option("cwd", {
      type: "string",
      default: process.cwd(),
      coerce: (value: string) => path.resolve(value),
      describe: "Run as if sachi started in this directory.",
    })
    .option("debug", {
      type: "boolean",
      default: false,
      describe: "Enable debug output.",
    })
    .option("interactive", {
      type: "boolean",
      default: true,
      describe: "Enable interactive flows when available.",
    })
    .option("verify", {
      type: "boolean",
      default: true,
      describe: "Keep verification hooks enabled.",
    })
    .option("quiet", {
      alias: "q",
      type: "boolean",
      default: false,
      describe: "Reduce non-essential output.",
    })
    .scriptName("sachi")
    .usage("$0 <command> [flags]")
    .help("help")
    .alias("help", "h")
    .version("version", version())
    .alias("version", "v")
    .recommendCommands()
    .strict()
    .strictCommands()
    .wrap(null)
    .showHelpOnFail(false)
    .fail((msg, error) => {
      throw error ?? new Error(msg ?? "Command failed.");
    })
    .command(init)
    .command(
      stub(
        "create",
        "Create the next stacked branch.",
        "Branch creation is planned for a later milestone.",
        "git switch -c <branch>",
      ),
    )
    .command(
      stub("submit", "Prepare stack submission.", "Submission is planned for a later milestone."),
    )
    .command(
      stub(
        "modify",
        "Modify the current branch metadata.",
        "Branch modification is planned for a later milestone.",
        "git commit --amend",
      ),
    )
    .command(
      stub(
        "restack",
        "Restack tracked branches.",
        "Restacking is planned for a later milestone.",
        "git rebase <parent>",
      ),
    )
    .command(
      stub(
        "sync",
        "Sync local state with remotes.",
        "Remote sync is planned for a later milestone.",
        "git fetch --all --prune",
      ),
    )
    .command(
      stub(
        "checkout",
        "Checkout a tracked branch.",
        "Tracked checkout is planned for a later milestone.",
        "git switch <branch>",
      ),
    )
    .command(log)
    .command(up)
    .command(down)
    .command(guide);

export const main = async (raw = process.argv.slice(2)) => {
  const plan = argv(raw);

  if (plan.kind === "help") {
    process.stdout.write(
      [
        `${info("sachi")} keeps stacked work explicit, local, and inspectable.`,
        "",
        "USAGE",
        `  ${cmd("sachi")} <command> [flags]`,
        `  ${cmd("sachi")} <command> --help`,
        `  ${cmd("sachi")} <git-command> [...]`,
        "",
        "TERMS",
        `  stack      A tracked branch tree rooted at ${branch("trunk")}.`,
        `  trunk      The long-lived base branch for the repo, usually ${branch("main")}.`,
        `  downstack  Branches closer to trunk than your current branch.`,
        `  upstack    Branches that build on top of your current branch.`,
        "",
        "CORE COMMANDS",
        `  ${cmd("sachi init")}             Create local stack metadata for this repo.`,
        `  ${cmd("sachi create")}           Create the next stacked branch ${dim("(stub)")}.`,
        `  ${cmd("sachi log")}              Show the tracked stack tree.`,
        `  ${cmd("sachi up")}               Move to a unique child branch.`,
        `  ${cmd("sachi down")}             Move to the parent branch.`,
        `  ${cmd("sachi restack")}          Rebase stack relationships ${dim("(stub)")}.`,
        `  ${cmd("sachi submit")}           Prepare stack submission ${dim("(stub)")}.`,
        "",
        "CORE WORKFLOW",
        `  1. ${cmd("sachi init")} to track ${branch("trunk")} locally.`,
        `  2. Create a first branch, then create child branches on top of it.`,
        `  3. Inspect the stack with ${cmd("sachi log")}.`,
        `  4. Move through the tree with ${cmd("sachi up")} and ${cmd("sachi down")}.`,
        `  5. Use ${cmd("sachi restack")} when base branches change later.`,
        "",
        "LEARN MORE",
        `  Unsupported commands are passed to ${cmd("git")}.`,
        `  ${cmd("sachi <command> --help")} shows command help.`,
        `  ${cmd("sachi guide workflow")} teaches the model.`,
        "",
        "FLAGS",
        `  ${cmd("--cwd")} <dir>            Run as if started in another directory.`,
        `  ${cmd("--debug")}                Print more detail when commands grow deeper.`,
        `  ${cmd("--interactive")}          Keep interactive flows enabled when they exist.`,
        `  ${cmd("--no-interactive")}       Disable interactive flows.`,
        `  ${cmd("--verify")}               Keep verification hooks enabled.`,
        `  ${cmd("--no-verify")}            Disable verification hooks.`,
        `  ${cmd("-q")}, ${cmd("--quiet")}           Reduce non-essential output.`,
        `  ${cmd("-h")}, ${cmd("--help")}            Show this screen.`,
        `  ${cmd("-v")}, ${cmd("--version")}         Show the package version.`,
        "",
        hint("Known commands use yargs help. Unknown commands fall back to git."),
        muted("Milestone 1 stays text-first: no TUI, no pager, no remote workflow engine."),
      ].join("\n") + "\n",
    );
    return 0;
  }

  if (plan.kind === "version") {
    process.stdout.write(`${version()}\n`);
    return 0;
  }

  if (plan.kind === "git") {
    return code(call(plan.args, plan.cwd, "inherit").status);
  }

  await boot().parseAsync(plan.args);
  return process.exitCode ?? 0;
};

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${err(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 1;
  },
);

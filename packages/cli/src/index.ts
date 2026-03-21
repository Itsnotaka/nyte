import path from "node:path";

import type { CommandModule } from "yargs";
import yargs from "yargs/yargs";

import { call, code, git_branch, switch_to } from "./git.ts";
import { argv } from "./plan.ts";
import { read, tracked, write, type Stack } from "./stack.ts";
import {
  branch,
  cmd,
  current,
  dim,
  err,
  fail,
  hint,
  info,
  muted,
  note,
  ok,
  say,
  warn,
} from "./term.ts";
import { version } from "./version.ts";

type Args = {
  cwd: string;
  debug: boolean;
  interactive: boolean;
  verify: boolean;
  quiet: boolean;
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

    const list = stack.branches[now]?.children ?? [];

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

    const up = stack.branches[now]?.parent ?? null;

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
        `  Unsupported commands are passed to ${cmd("git")} with the same short banner ${cmd("gt")} prints.`,
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
    if (plan.announce) {
      say(hint("Passing command through to git..."));
      say(hint(`Running: "git ${plan.args.join(" ")}"`));
    }
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

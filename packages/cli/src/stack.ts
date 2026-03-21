import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { call } from "./git.ts";

export type Node = {
  parent: string | null;
  children: string[];
};

export type Stack = {
  trunk: string;
  branches: Record<string, Node>;
};

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

export const read = (cwd: string) => {
  const name = file(cwd);

  if (!name) {
    throw new Error("Not inside a git repository.");
  }

  if (!existsSync(name)) {
    throw new Error("sachi is not initialized in this repo. Run `sachi init` first.");
  }

  return parse(readFileSync(name, "utf8"));
};

export const write = (cwd: string, stack: Stack) => {
  const name = file(cwd);

  if (!name) {
    throw new Error("Not inside a git repository.");
  }

  mkdirSync(path.dirname(name), { recursive: true });
  writeFileSync(name, `${JSON.stringify(normalize(stack), null, 2)}\n`);
};

export const tracked = (stack: Stack, name: string | null) =>
  name && stack.branches[name] !== undefined ? name : null;

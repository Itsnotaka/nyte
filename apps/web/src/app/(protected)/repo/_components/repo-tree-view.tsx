"use client";

import { IconFileText, IconFolder1 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import type { GitHubTreeEntry } from "@sachikit/github";
import Link from "next/link";
import * as React from "react";

type RepoTreeViewProps = {
  owner: string;
  repo: string;
  ref: string;
  entries: GitHubTreeEntry[];
  currentPath?: string;
};

export function RepoTreeView({ owner, repo, ref, entries, currentPath }: RepoTreeViewProps) {
  const sorted = React.useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.type === "tree" && b.type !== "tree") return -1;
        if (a.type !== "tree" && b.type === "tree") return 1;
        return a.path.localeCompare(b.path);
      }),
    [entries],
  );

  const prefix = currentPath ? `${currentPath}/` : "";

  return (
    <div className="divide-y divide-sachi-line-subtle rounded-lg border border-sachi-line">
      {currentPath ? (
        <Link
          href={
            currentPath.includes("/")
              ? `/repo/${owner}/${repo}/tree/${currentPath.split("/").slice(0, -1).join("/")}?ref=${ref}`
              : `/repo/${owner}/${repo}?ref=${ref}`
          }
          className="flex items-center gap-2 px-3 py-2 text-sm text-sachi-fg-secondary transition-colors hover:bg-sachi-fill"
        >
          <span className="text-sachi-fg-muted">..</span>
        </Link>
      ) : null}
      {sorted.map((entry) => {
        const name = entry.path.split("/").pop() ?? entry.path;
        const href =
          entry.type === "tree"
            ? `/repo/${owner}/${repo}/tree/${prefix}${entry.path}?ref=${ref}`
            : `/repo/${owner}/${repo}/blob/${prefix}${entry.path}?ref=${ref}`;

        return (
          <Link
            key={entry.sha}
            href={href}
            className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-sachi-fill"
          >
            {entry.type === "tree" ? (
              <IconFolder1 className="size-4 shrink-0 text-sachi-accent" />
            ) : (
              <IconFileText className="size-4 shrink-0 text-sachi-fg-muted" />
            )}
            <span className="min-w-0 flex-1 truncate text-sachi-fg">{name}</span>
            {entry.type === "blob" && entry.size !== null ? (
              <span className="shrink-0 text-xs text-sachi-fg-faint">
                {entry.size < 1024
                  ? `${String(entry.size)} B`
                  : `${String(Math.round(entry.size / 1024))} KB`}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

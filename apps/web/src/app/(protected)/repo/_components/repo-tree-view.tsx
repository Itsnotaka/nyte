"use client";

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

function FolderIcon() {
  return (
    <svg className="size-4 shrink-0 text-sachi-accent" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.94.94a.5.5 0 00.354.12H13.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="size-4 shrink-0 text-sachi-fg-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M4 1.5h5.5L13 5v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-13a1 1 0 011-1z" />
      <path d="M9 1.5V5.5h4" />
    </svg>
  );
}

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
            {entry.type === "tree" ? <FolderIcon /> : <FileIcon />}
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

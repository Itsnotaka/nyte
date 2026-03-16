"use client";

import { Badge } from "@ticu/ui/components/badge";
import { Input } from "@ticu/ui/components/input";
import Link from "next/link";
import * as React from "react";

import { useRepo } from "./repo-context";

function formatUpdated(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${String(diffHours)}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${String(diffDays)}d ago`;

  return `${String(Math.floor(diffDays / 30))}mo ago`;
}

export function RepoLanding() {
  const { repos } = useRepo();
  const [search, setSearch] = React.useState("");

  const filtered = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="h-full min-h-0 bg-[var(--color-inset-bg)]">
      <div className="mx-auto flex h-full w-full max-w-[860px] flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Repositories
          </h1>
          <span className="text-xs text-[var(--color-text-muted)]">
            {repos.length} {repos.length === 1 ? "repository" : "repositories"}
          </span>
        </header>

        <div className="max-w-xs">
          <Input
            type="search"
            placeholder="Search repositories..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y divide-[var(--color-border-subtle)] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)]">
            {filtered.map((repo) => (
              <Link
                key={repo.id}
                href={`/repo/${repo.owner.login}/${repo.name}/submit`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[var(--color-sidebar-link-bg)]"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {repo.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {repo.private ? "private" : "public"}
                    </Badge>
                  </div>
                  {repo.description ? (
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {repo.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--color-text-faint)]">
                  {repo.language ? <span>{repo.language}</span> : null}
                  <span>{formatUpdated(repo.updated_at)}</span>
                </div>
              </Link>
            ))}

            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                {search
                  ? "No repositories match your search."
                  : "No repositories found for this installation."}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

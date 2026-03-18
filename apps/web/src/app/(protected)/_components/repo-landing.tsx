"use client";

import { Badge } from "@sachikit/ui/components/badge";
import { Input } from "@sachikit/ui/components/input";
import Link from "next/link";
import * as React from "react";

import { formatRelativeTime } from "~/lib/time";

import { useRepoStore } from "./repo-context";

export function RepoLanding() {
  const repos = useRepoStore((s) => s.repos);
  const [search, setSearch] = React.useState("");

  const filtered = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="h-full min-h-0 bg-sachi-base">
      <div className="mx-auto flex h-full w-full max-w-[860px] flex-col gap-4 px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-sachi-fg">Repositories</h1>
          <span className="text-xs text-sachi-fg-muted">
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
          <div className="divide-y divide-sachi-line-subtle rounded-xl border border-sachi-line-subtle bg-sachi-surface">
            {filtered.map((repo) => (
              <Link
                key={repo.id}
                href={`/repo/${repo.owner.login}/${repo.name}/submit`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-sachi-fill"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-sachi-fg">
                      {repo.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {repo.private ? "private" : "public"}
                    </Badge>
                  </div>
                  {repo.description ? (
                    <p className="truncate text-xs text-sachi-fg-muted">
                      {repo.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-4 text-xs text-sachi-fg-faint">
                  {repo.language ? <span>{repo.language}</span> : null}
                  <span>{formatRelativeTime(repo.updated_at)}</span>
                </div>
              </Link>
            ))}

            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-sachi-fg-muted">
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

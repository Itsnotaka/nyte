"use client";

import type { GitHubInstallation, GitHubRepository } from "@nyte/github";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@nyte/ui/components/avatar";
import { Badge } from "@nyte/ui/components/badge";
import { Input } from "@nyte/ui/components/input";
import * as React from "react";

type RepoLandingProps = {
  installation: GitHubInstallation;
  repos: GitHubRepository[];
};

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

  const diffMonths = Math.floor(diffDays / 30);
  return `${String(diffMonths)}mo ago`;
}

export function RepoLanding({ installation, repos }: RepoLandingProps) {
  const [search, setSearch] = React.useState("");

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="h-full min-h-0 bg-[var(--color-inset-bg)]">
      <div className="mx-auto flex h-full w-full max-w-[860px] flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarImage src={installation.account.avatar_url} />
              <AvatarFallback>
                {installation.account.login.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {installation.account.login}
            </h1>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            {repos.length} {repos.length === 1 ? "repository" : "repositories"}
          </span>
        </header>

        <div className="max-w-xs">
          <Input
            type="search"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y divide-[var(--color-border-subtle)] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)]">
            {filtered.map((repo) => (
              <div
                key={repo.id}
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
              </div>
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

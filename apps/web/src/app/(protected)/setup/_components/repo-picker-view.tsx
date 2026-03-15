"use client";

import type { GitHubInstallation, GitHubRepository } from "@nyte/github";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@nyte/ui/components/avatar";
import { Button } from "@nyte/ui/components/button";
import { Checkbox } from "@nyte/ui/components/checkbox";
import { Input } from "@nyte/ui/components/input";
import { useRouter } from "next/navigation";
import * as React from "react";

type RepoPickerViewProps = {
  installation: GitHubInstallation;
  repos: GitHubRepository[];
  appInstallUrl: string;
};

export function RepoPickerView({ installation, repos }: RepoPickerViewProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleRepo(repoId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  function handleContinue() {
    const selectedRepos = repos.filter((r) => selected.has(r.id));
    const encoded = encodeURIComponent(
      JSON.stringify(selectedRepos.map((r) => r.full_name))
    );
    router.push(`/?repos=${encoded}`);
  }

  return (
    <section className="flex h-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar size="lg">
            <AvatarImage src={installation.account.avatar_url} />
            <AvatarFallback>
              {installation.account.login.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Select repos to sync
          </h1>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            Choose the repositories you want to work with in Nyte. You can
            change this later.
          </p>
        </div>

        <div className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)]">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Select repositories
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {selected.size} of {repos.length} repos selected
            </span>
          </div>

          <div className="px-4 pb-2">
            <Input
              type="search"
              placeholder="Search repositories"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.map((repo) => (
              <label
                key={repo.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--color-sidebar-link-bg)]"
              >
                <Checkbox
                  checked={selected.has(repo.id)}
                  onCheckedChange={() => toggleRepo(repo.id)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {repo.name}
                </span>
                {repo.private ? (
                  <span className="ml-auto text-xs text-[var(--color-text-faint)]">
                    private
                  </span>
                ) : null}
              </label>
            ))}
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-[var(--color-text-muted)]">
                No repositories match your search.
              </p>
            ) : null}
          </div>

          {selected.size > 0 ? (
            <div className="border-t border-[var(--color-border-subtle)] px-4 py-2">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        <Button
          size="lg"
          disabled={selected.size === 0}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </section>
  );
}

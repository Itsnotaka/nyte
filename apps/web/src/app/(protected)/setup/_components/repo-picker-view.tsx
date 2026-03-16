"use client";

import type { GitHubInstallation, GitHubRepository } from "@sachikit/github";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Button } from "@sachikit/ui/components/button";
import { Checkbox } from "@sachikit/ui/components/checkbox";
import { Input } from "@sachikit/ui/components/input";
import { useRouter } from "next/navigation";
import * as React from "react";

export function RepoPickerView({
  installation,
  repos,
}: {
  installation: GitHubInstallation;
  repos: GitHubRepository[];
}) {
  const router = useRouter();
  const [isNavigating, startNavigation] = React.useTransition();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const filtered = repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

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
    startNavigation(() => {
      router.push("/");
    });
  }

  return (
    <section className="flex h-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar size="lg">
            <AvatarImage src={installation.account.avatar_url} />
            <AvatarFallback>{installation.account.login.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-semibold text-sachi-fg">Select repos to sync</h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            Choose the repositories you want to work with in Nyte. You can change this later.
          </p>
        </div>

        <div className="w-full rounded-xl border border-sachi-line-subtle bg-sachi-surface">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-sm font-medium text-sachi-fg">Select repositories</span>
            <span className="text-xs text-sachi-fg-muted">
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
                className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-sachi-fill"
              >
                <Checkbox
                  checked={selected.has(repo.id)}
                  onCheckedChange={() => toggleRepo(repo.id)}
                />
                <span className="text-sm text-sachi-fg-secondary">{repo.name}</span>
                {repo.private ? (
                  <span className="ml-auto text-xs text-sachi-fg-faint">private</span>
                ) : null}
              </label>
            ))}
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-sachi-fg-muted">
                No repositories match your search.
              </p>
            ) : null}
          </div>

          {selected.size > 0 ? (
            <div className="border-t border-sachi-line-subtle px-4 py-2">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-sachi-fg-muted hover:text-sachi-fg-secondary"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        <Button size="lg" disabled={selected.size === 0 || isNavigating} onClick={handleContinue}>
          {isNavigating ? "Continuing..." : "Continue"}
        </Button>
      </div>
    </section>
  );
}

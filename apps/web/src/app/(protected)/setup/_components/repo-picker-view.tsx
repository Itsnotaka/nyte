"use client";

import type { GitHubInstallation, GitHubRepository } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { Checkbox } from "@sachikit/ui/components/checkbox";
import { Input } from "@sachikit/ui/components/input";
import {
  LayerCard,
  LayerCardPrimary,
  LayerCardSecondary,
} from "@sachikit/ui/components/layer-card";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Separator } from "@sachikit/ui/components/separator";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/client";

type RepoPickerViewProps = {
  installations: GitHubInstallation[];
  repos: GitHubRepository[];
  syncedRepoIds: number[];
};

function RepoRow({
  repo,
  checked,
  onToggle,
}: {
  repo: GitHubRepository;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-sachi-fill-hover">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="min-w-0 flex-1 truncate text-sm text-sachi-fg-secondary">
        {repo.full_name}
      </span>
      {repo.private ? <Badge variant="outline">private</Badge> : null}
    </label>
  );
}

export function RepoPickerView({
  installations,
  repos,
  syncedRepoIds,
}: RepoPickerViewProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<number>>(
    () => new Set(syncedRepoIds)
  );

  const filtered = React.useMemo(
    () =>
      repos.filter((repo) =>
        repo.full_name.toLowerCase().includes(search.toLowerCase())
      ),
    [repos, search]
  );

  const toggle = (repoId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const saveMutation = useMutation(
    trpc.repoSync.updateSyncedRepos.mutationOptions({
      onSuccess: () => {
        router.replace("/");
      },
    })
  );

  function handleSave() {
    const selectedRepos = repos.filter((r) => selected.has(r.id));
    saveMutation.mutate({
      repos: selectedRepos.map((r) => {
        const inst = installations.find(
          (i) => i.account.login.toLowerCase() === r.owner.login.toLowerCase()
        );
        if (!inst) {
          throw new Error(`No installation found for owner: ${r.owner.login}`);
        }
        return {
          githubRepoId: r.id,
          installationId: inst.id,
          ownerLogin: r.owner.login,
          repoName: r.name,
          repoFullName: r.full_name,
          isPrivate: r.private,
        };
      }),
    });
  }

  const selectedRepos = repos.filter((r) => selected.has(r.id));
  const unselectedFiltered = filtered.filter((r) => !selected.has(r.id));

  return (
    <section className="flex h-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-sachi-fg">
            Select repositories
          </h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            Choose which repositories to sync with Sachi. Only synced repos will
            appear in your inbox and be available for review.
          </p>
        </div>

        <LayerCard className="w-full">
          <LayerCardSecondary>
            <span>Select repositories</span>
            <span className="text-xs text-sachi-fg-muted tabular-nums">
              {String(selected.size)} of {String(repos.length)}
            </span>
          </LayerCardSecondary>

          <LayerCardPrimary className="gap-0 px-0 py-0">
            <div className="px-3 py-2">
              <Input
                type="search"
                placeholder="Search repositories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Separator />

            <ScrollArea className="max-h-80">
              {selectedRepos.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-medium text-sachi-fg-muted">
                    Selected repositories
                  </p>
                  {selectedRepos.map((repo) => (
                    <RepoRow
                      key={repo.id}
                      repo={repo}
                      checked={true}
                      onToggle={() => toggle(repo.id)}
                    />
                  ))}
                </div>
              )}

              {unselectedFiltered.length > 0 && (
                <div>
                  {selectedRepos.length > 0 && (
                    <p className="px-3 py-1.5 text-xs font-medium text-sachi-fg-muted">
                      Everything else
                    </p>
                  )}
                  {unselectedFiltered.map((repo) => (
                    <RepoRow
                      key={repo.id}
                      repo={repo}
                      checked={false}
                      onToggle={() => toggle(repo.id)}
                    />
                  ))}
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-sachi-fg-muted">
                  No repositories match your search.
                </p>
              ) : null}
            </ScrollArea>

            {selected.size > 0 && (
              <>
                <Separator />
                <div className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-sachi-fg-muted transition-colors hover:text-sachi-fg"
                  >
                    Clear all
                  </button>
                </div>
              </>
            )}
          </LayerCardPrimary>
        </LayerCard>

        <Button
          size="lg"
          disabled={saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending
            ? "Saving..."
            : `Sync ${String(selected.size)} ${selected.size === 1 ? "repository" : "repositories"}`}
        </Button>

        {saveMutation.error ? (
          <p className="text-sm text-destructive">
            {saveMutation.error.message ?? "Failed to save repo selection."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

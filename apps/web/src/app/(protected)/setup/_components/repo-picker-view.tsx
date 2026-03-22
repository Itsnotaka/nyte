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

import { useTRPC } from "~/lib/trpc/react";

type CatalogEntry = {
  installation: GitHubInstallation;
  repository: GitHubRepository;
};

type RepoPickerViewProps = {
  entries: CatalogEntry[];
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

export function RepoPickerView({ entries, syncedRepoIds }: RepoPickerViewProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set(syncedRepoIds));
  const q = search.toLowerCase();

  const repos = React.useMemo(() => entries.map((e) => e.repository), [entries]);

  const filteredEntries = React.useMemo(
    () => entries.filter((e) => e.repository.full_name.toLowerCase().includes(q)),
    [entries, q],
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
    }),
  );

  function handleSave() {
    const selectedEntries = entries.filter((e) => selected.has(e.repository.id));
    saveMutation.mutate({
      repos: selectedEntries.map((e) => ({
        githubRepoId: e.repository.id,
        installationId: e.installation.id,
        ownerLogin: e.repository.owner.login,
        repoName: e.repository.name,
        repoFullName: e.repository.full_name,
        isPrivate: e.repository.private,
      })),
    });
  }

  const selectedRepos = repos.filter((r) => selected.has(r.id));
  const unselectedFiltered = filteredEntries
    .filter((e) => !selected.has(e.repository.id))
    .map((e) => e.repository);

  const hadSynced = syncedRepoIds.length > 0;
  const title = hadSynced ? "Synced repositories" : "Select repositories";
  const actionLabel = hadSynced ? "Save" : "Sync";

  return (
    <section className="flex h-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-sachi-fg">{title}</h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            {hadSynced
              ? "Add or remove repositories synced with Sachi. Only synced repos appear in your inbox and are available for review."
              : "Choose which repositories to sync with Sachi. Only synced repos will appear in your inbox and be available for review."}
          </p>
        </div>

        <LayerCard className="w-full">
          <LayerCardSecondary>
            <span>{title}</span>
            <span className="text-xs text-sachi-fg-muted tabular-nums">
              {String(selected.size)} of {String(entries.length)}
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

              {entries.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-sachi-fg-muted">
                  No repositories available from your installations.
                </p>
              ) : search && filteredEntries.length === 0 ? (
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

        <Button size="lg" disabled={saveMutation.isPending} onClick={handleSave}>
          {saveMutation.isPending
            ? "Saving..."
            : `${actionLabel} ${String(selected.size)} ${selected.size === 1 ? "repository" : "repositories"}`}
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

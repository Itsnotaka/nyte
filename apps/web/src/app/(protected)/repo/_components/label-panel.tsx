"use client";

import {
  IconCrossMedium,
  IconPlusSmall,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import type { GitHubLabel } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { Input } from "@sachikit/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@sachikit/ui/components/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/react";

type LabelPanelProps = {
  owner: string;
  repo: string;
  pullNumber: number;
  currentLabels: GitHubLabel[];
  pullRequestPageQueryKey: readonly unknown[];
};

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function LabelPanel({
  owner,
  repo,
  pullNumber,
  currentLabels,
  pullRequestPageQueryKey,
}: LabelPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const identity = { owner, pullNumber, repo };

  const repoLabelsQuery = useQuery(
    trpc.github.listRepoLabels.queryOptions({ owner, repo }, { staleTime: 300_000, enabled: open }),
  );

  const addLabel = useMutation(
    trpc.github.addLabels.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  const removeLabelMutation = useMutation(
    trpc.github.removeLabel.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  const currentNames = new Set(currentLabels.map((label) => label.name));
  const available = (repoLabelsQuery.data ?? []).filter(
    (label) =>
      !currentNames.has(label.name) && label.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Add label">
                <IconPlusSmall />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-56 space-y-2 p-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter labels..."
              className="h-7 text-xs"
            />
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {available.length === 0 ? (
                <p className="py-1 text-xs text-sachi-fg-muted">
                  {repoLabelsQuery.isLoading ? "Loading..." : "No labels found"}
                </p>
              ) : (
                available.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-sachi-fill"
                    onClick={() => {
                      addLabel.mutate({ ...identity, labels: [label.name] });
                      setOpen(false);
                    }}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    <span className="truncate text-sachi-fg-secondary">{label.name}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {currentLabels.length === 0 ? (
        <p className="text-xs text-sachi-fg-faint">No labels</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {currentLabels.map((label) => (
            <Badge
              key={label.id}
              className="gap-1 text-xs"
              style={{
                backgroundColor: `#${label.color}`,
                color: contrastColor(label.color),
              }}
            >
              {label.name}
              <button
                type="button"
                className="ml-0.5 opacity-70 hover:opacity-100"
                onClick={() => removeLabelMutation.mutate({ ...identity, label: label.name })}
                aria-label={`Remove ${label.name}`}
              >
                <IconCrossMedium className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

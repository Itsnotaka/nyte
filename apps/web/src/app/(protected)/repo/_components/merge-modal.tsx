"use client";

import type { GitHubCheckSummary } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sachikit/ui/components/dialog";
import { Input } from "@sachikit/ui/components/input";
import { Textarea } from "@sachikit/ui/components/textarea";
import { cn } from "@sachikit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/client";

type MergeMethod = "merge" | "squash" | "rebase";

type MergeModalProps = {
  pullTitle: string;
  pullBody: string | null;
  pullNumber: number;
  owner: string;
  repo: string;
  headSha: string;
  disabled: boolean;
  isPending: boolean;
  onMerge: (options: {
    mergeMethod: MergeMethod;
    commitTitle: string;
    commitMessage: string;
  }) => void;
  trigger: React.ReactNode;
};

const STRATEGIES: { id: MergeMethod; label: string; description: string }[] = [
  {
    id: "squash",
    label: "Squash and merge",
    description: "Combine all commits into one commit on the base branch.",
  },
  {
    id: "merge",
    label: "Create a merge commit",
    description: "Preserve all commits and add a merge commit.",
  },
  {
    id: "rebase",
    label: "Rebase and merge",
    description: "Rebase commits onto the base branch without a merge commit.",
  },
];

function defaultTitle(method: MergeMethod, pullTitle: string, pullNumber: number): string {
  if (method === "squash") return `${pullTitle} (#${String(pullNumber)})`;
  if (method === "merge") return `Merge pull request #${String(pullNumber)}`;
  return "";
}

function defaultMessage(method: MergeMethod, pullBody: string | null): string {
  if (method === "squash") return pullBody ?? "";
  return "";
}

function CheckWarning({ summary }: { summary: GitHubCheckSummary | null | undefined }) {
  if (!summary) return null;
  if (summary.conclusion === "success" || summary.total === 0) return null;

  if (summary.conclusion === "failure") {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900/50">
        {String(summary.failing)} check{summary.failing === 1 ? "" : "s"} failing.
        Merging is not recommended.
      </div>
    );
  }

  if (summary.conclusion === "pending") {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900/50">
        {String(summary.pending)} check{summary.pending === 1 ? "" : "s"} still running.
      </div>
    );
  }

  return null;
}

export function MergeModal({
  pullTitle,
  pullBody,
  pullNumber,
  owner,
  repo,
  headSha,
  disabled,
  isPending,
  onMerge,
  trigger,
}: MergeModalProps) {
  const trpc = useTRPC();
  const [method, setMethod] = React.useState<MergeMethod>("squash");
  const [title, setTitle] = React.useState(() => defaultTitle("squash", pullTitle, pullNumber));
  const [message, setMessage] = React.useState(() => defaultMessage("squash", pullBody));
  const [open, setOpen] = React.useState(false);

  const summaryQuery = useQuery(
    trpc.github.getCheckSummary.queryOptions(
      { owner, repo, ref: headSha },
      { staleTime: 60_000, enabled: open },
    ),
  );

  function handleStrategyChange(next: MergeMethod) {
    setMethod(next);
    setTitle(defaultTitle(next, pullTitle, pullNumber));
    setMessage(defaultMessage(next, pullBody));
  }

  function handleSubmit() {
    onMerge({ mergeMethod: method, commitTitle: title, commitMessage: message });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge pull request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <CheckWarning summary={summaryQuery.data} />

          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wider text-sachi-fg-muted uppercase">
              Strategy
            </p>
            <div className="space-y-1.5">
              {STRATEGIES.map((strategy) => (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => handleStrategyChange(strategy.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    method === strategy.id
                      ? "border-sachi-accent bg-sachi-fill"
                      : "border-sachi-line hover:bg-sachi-fill",
                  )}
                >
                  <span className="text-sm font-medium text-sachi-fg">
                    {strategy.label}
                  </span>
                  <span className="text-xs text-sachi-fg-muted">
                    {strategy.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {method !== "rebase" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-sachi-fg">
                  Commit title
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-sachi-fg">
                  Commit message
                </label>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  disabled={isPending}
                />
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={disabled || isPending}
              onClick={handleSubmit}
            >
              {isPending ? "Merging..." : "Confirm merge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

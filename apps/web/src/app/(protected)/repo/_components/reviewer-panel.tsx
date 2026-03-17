"use client";

import type { GitHubAccount } from "@sachikit/github";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Button } from "@sachikit/ui/components/button";
import { Input } from "@sachikit/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@sachikit/ui/components/popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/client";

type ReviewerPanelProps = {
  owner: string;
  repo: string;
  pullNumber: number;
  requestedReviewers: GitHubAccount[];
  pullRequestPageQueryKey: readonly unknown[];
};

export function ReviewerPanel({
  owner,
  repo,
  pullNumber,
  requestedReviewers,
  pullRequestPageQueryKey,
}: ReviewerPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [username, setUsername] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const identity = { owner, pullNumber, repo };

  const addReviewer = useMutation(
    trpc.github.requestReviewers.mutationOptions({
      onSuccess: async () => {
        setUsername("");
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: pullRequestPageQueryKey });
      },
    }),
  );

  const removeReviewer = useMutation(
    trpc.github.removeReviewer.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: pullRequestPageQueryKey });
      },
    }),
  );

  function handleAdd() {
    const trimmed = username.trim();
    if (trimmed.length === 0) return;
    addReviewer.mutate({ ...identity, reviewers: [trimmed] });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-sachi-fg-muted">Reviewers</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Add reviewer">
                <PlusIcon />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-56 space-y-2 p-3">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="GitHub username"
              className="h-7 text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              size="sm"
              className="w-full"
              disabled={username.trim().length === 0 || addReviewer.isPending}
              onClick={handleAdd}
            >
              {addReviewer.isPending ? "Adding..." : "Add reviewer"}
            </Button>
            {addReviewer.error ? (
              <p className="text-xs text-destructive">{addReviewer.error.message}</p>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {requestedReviewers.length === 0 ? (
        <p className="text-xs text-sachi-fg-faint">No reviewers requested</p>
      ) : (
        <div className="space-y-1">
          {requestedReviewers.map((reviewer) => (
            <div
              key={reviewer.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-1"
            >
              <Avatar size="sm">
                <AvatarImage src={reviewer.avatar_url} alt={reviewer.login} />
                <AvatarFallback>
                  {reviewer.login.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-xs text-sachi-fg-secondary">
                {reviewer.login}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${reviewer.login}`}
                disabled={removeReviewer.isPending}
                onClick={() =>
                  removeReviewer.mutate({ ...identity, reviewer: reviewer.login })
                }
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

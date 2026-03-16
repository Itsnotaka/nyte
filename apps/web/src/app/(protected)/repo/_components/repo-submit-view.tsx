"use client";

import type {
  GitHubBranch,
  GitHubPullRequest,
  GitHubRepository,
} from "@nyte/github";
import { Badge } from "@ticu/ui/components/badge";
import { Button } from "@ticu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ticu/ui/components/card";
import { Input } from "@ticu/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@ticu/ui/components/native-select";
import { Textarea } from "@ticu/ui/components/textarea";
import { InsetView } from "@ticu/ui/components/sidebar";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/client";

type RepoSubmitViewProps = {
  repository: GitHubRepository;
  branches: GitHubBranch[];
  initialBranch: string | null;
  existingPullRequest: GitHubPullRequest | null;
  openPullRequests: GitHubPullRequest[];
};

function branchTitle(branch: string): string {
  return branch
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatUpdated(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${String(diffHours)}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${String(diffDays)}d ago`;

  return `${String(Math.floor(diffDays / 30))}mo ago`;
}

export function RepoSubmitView({
  repository,
  branches,
  initialBranch,
  existingPullRequest,
  openPullRequests,
}: RepoSubmitViewProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const [title, setTitle] = React.useState(
    existingPullRequest?.title ??
      (initialBranch ? branchTitle(initialBranch) : "")
  );
  const [body, setBody] = React.useState(existingPullRequest?.body ?? "");

  const savePullRequest = useMutation(
    trpc.github.savePullRequest.mutationOptions({
      onSuccess: (pullRequest) => {
        router.push(
          `/repo/${repository.owner.login}/${repository.name}/pull/${String(pullRequest.number)}`
        );
        router.refresh();
      },
    })
  );

  const selectable = branches.filter(
    (branch) => branch.name !== repository.default_branch
  );
  const currentBranch = initialBranch ?? selectable[0]?.name ?? null;
  const hasClosedPullRequest =
    existingPullRequest != null &&
    (existingPullRequest.state === "closed" || existingPullRequest.merged);

  function onBranchChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const branch = event.target.value;
    router.push(
      `/repo/${repository.owner.login}/${repository.name}/submit?branch=${encodeURIComponent(branch)}`
    );
  }

  function onSave(draft: boolean) {
    if (!currentBranch) return;

    void savePullRequest.mutateAsync({
      body,
      draft,
      head: currentBranch,
      owner: repository.owner.login,
      repo: repository.name,
      title: title.trim(),
    });
  }

  return (
    <InsetView maxWidth="lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Submit pull request
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {repository.full_name} to `{repository.default_branch}`
            </p>
          </div>
          {existingPullRequest ? (
            <Link
              href={`/repo/${repository.owner.login}/${repository.name}/pull/${String(existingPullRequest.number)}`}
              className="text-sm text-[var(--color-text-secondary)] underline-offset-4 hover:underline"
            >
              View PR #{existingPullRequest.number}
            </Link>
          ) : null}
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Branch</CardTitle>
              <CardDescription>
                Base branch is fixed to the repository default branch in v1.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectable.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Head branch
                  </label>
                  <NativeSelect value={currentBranch ?? ""} onChange={onBranchChange}>
                    {selectable.map((branch) => (
                      <NativeSelectOption key={branch.name} value={branch.name}>
                        {branch.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No submit-ready branches found yet.
                </p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Pull request title"
                  disabled={!currentBranch || hasClosedPullRequest}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  Description
                </label>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="What changed?"
                  disabled={!currentBranch || hasClosedPullRequest}
                />
              </div>

              {existingPullRequest ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Badge variant="outline">
                    {existingPullRequest.draft ? "draft" : existingPullRequest.state}
                  </Badge>
                  <span>PR #{existingPullRequest.number}</span>
                  <span>updated {formatUpdated(existingPullRequest.updated_at)}</span>
                </div>
              ) : null}

              {savePullRequest.error ? (
                <p className="text-sm text-red-500">{savePullRequest.error.message}</p>
              ) : null}

              {hasClosedPullRequest ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  This branch already has a closed pull request. Reopen or review the existing PR instead of creating a new one.
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <span className="text-xs text-[var(--color-text-muted)]">
                Base: `{repository.default_branch}`
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={
                    !currentBranch ||
                    hasClosedPullRequest ||
                    title.trim().length === 0 ||
                    savePullRequest.isPending
                  }
                  onClick={() => onSave(true)}
                >
                  {existingPullRequest?.draft ? "Update draft" : "Save draft"}
                </Button>
                <Button
                  disabled={
                    !currentBranch ||
                    hasClosedPullRequest ||
                    title.trim().length === 0 ||
                    savePullRequest.isPending
                  }
                  onClick={() => onSave(false)}
                >
                  {existingPullRequest?.draft
                    ? "Publish"
                    : existingPullRequest
                      ? "Update PR"
                      : "Create PR"}
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open pull requests</CardTitle>
              <CardDescription>
                Existing PRs for this repository.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {openPullRequests.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No open pull requests.
                </p>
              ) : (
                openPullRequests.map((pullRequest) => (
                  <Link
                    key={pullRequest.id}
                    href={`/repo/${repository.owner.login}/${repository.name}/pull/${String(pullRequest.number)}`}
                    className="block rounded-lg border border-[var(--color-border-subtle)] p-3 text-sm hover:bg-[var(--color-sidebar-link-bg)]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {pullRequest.title}
                      </span>
                      {pullRequest.draft ? <Badge variant="outline">draft</Badge> : null}
                    </div>
                    <p className="mt-1 text-[var(--color-text-muted)]">
                      {pullRequest.head.ref} to {pullRequest.base.ref}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
    </InsetView>
  );
}

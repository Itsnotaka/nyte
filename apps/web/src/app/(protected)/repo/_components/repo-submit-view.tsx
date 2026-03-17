"use client";

import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sachikit/ui/components/card";
import { Input } from "@sachikit/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@sachikit/ui/components/native-select";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Textarea } from "@sachikit/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import * as React from "react";

import type { RepoSubmitPageData } from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";
import { useTRPC } from "~/lib/trpc/client";

type RepoSubmitViewProps = {
  initialData: RepoSubmitPageData;
};

function branchTitle(branch: string): string {
  return branch
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function RepoSubmitView({ initialData }: RepoSubmitViewProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [branch, setBranch] = useQueryState("branch", parseAsString);
  const initialBranchRef = React.useRef(branch);
  const shouldUseInitialDataRef = React.useRef(true);
  const queryInput = React.useMemo(
    () => ({
      branch,
      owner: initialData.repository.owner.login,
      repo: initialData.repository.name,
    }),
    [branch, initialData.repository.name, initialData.repository.owner.login]
  );
  const initialQueryData =
    shouldUseInitialDataRef.current && branch === initialBranchRef.current
      ? initialData
      : undefined;
  if (initialQueryData) {
    shouldUseInitialDataRef.current = false;
  }
  const repoSubmitPage = useQuery(
    trpc.github.getRepoSubmitPage.queryOptions(queryInput, {
      initialData: initialQueryData,
      placeholderData: (previousData) => previousData,
      staleTime: 0,
    })
  );
  const data = repoSubmitPage.data ?? initialData;
  const {
    repository,
    branches,
    existingPullRequest,
    openPullRequests,
    selectedBranch,
  } = data;
  const selectable = React.useMemo(
    () => branches.filter((item) => item.name !== repository.default_branch),
    [branches, repository.default_branch]
  );
  const branchValues = React.useMemo(
    () => ({
      body: data.existingPullRequest?.body ?? "",
      title:
        data.existingPullRequest?.title ??
        (data.selectedBranch ? branchTitle(data.selectedBranch) : ""),
    }),
    [data]
  );
  const [title, setTitle] = React.useState(branchValues.title);
  const [body, setBody] = React.useState(branchValues.body);
  const lastSelectedBranchRef = React.useRef(selectedBranch);
  const hasClosedPullRequest =
    existingPullRequest != null &&
    (existingPullRequest.state === "closed" || existingPullRequest.merged);
  const isBranchTransitionPending =
    repoSubmitPage.isFetching && branch != null && branch !== selectedBranch;
  const isFormDisabled =
    !selectedBranch || hasClosedPullRequest || isBranchTransitionPending;

  React.useEffect(() => {
    if (lastSelectedBranchRef.current === selectedBranch) {
      return;
    }

    lastSelectedBranchRef.current = selectedBranch;
    setTitle(branchValues.title);
    setBody(branchValues.body);
  }, [branchValues.body, branchValues.title, selectedBranch]);

  const savePullRequest = useMutation(
    trpc.github.savePullRequest.mutationOptions({
      onSuccess: async (pullRequest) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.github.getRepoSubmitPage.queryKey(queryInput),
        });
        router.push(
          `/repo/${repository.owner.login}/${repository.name}/pull/${String(pullRequest.number)}`
        );
      },
    })
  );

  function onBranchChange(event: React.ChangeEvent<HTMLSelectElement>) {
    void setBranch(event.target.value);
  }

  function onSave(draft: boolean) {
    if (!selectedBranch || isBranchTransitionPending) return;

    void savePullRequest.mutateAsync({
      body,
      draft,
      head: selectedBranch,
      owner: repository.owner.login,
      repo: repository.name,
      title: title.trim(),
    });
  }

  return (
    <InsetView maxWidth="lg">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-sachi-fg">
            Submit pull request
          </h1>
          <p className="text-sm text-sachi-fg-muted">
            {repository.full_name} to `{repository.default_branch}`
          </p>
        </div>
        {existingPullRequest ? (
          <Link
            href={`/repo/${repository.owner.login}/${repository.name}/pull/${String(existingPullRequest.number)}`}
            className="text-sm text-sachi-fg-secondary underline-offset-4 hover:underline"
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
                <label className="text-sm font-medium text-sachi-fg">
                  Head branch
                </label>
                <NativeSelect
                  value={branch ?? selectedBranch ?? ""}
                  onChange={onBranchChange}
                  disabled={savePullRequest.isPending}
                >
                  {selectable.map((item) => (
                    <NativeSelectOption key={item.name} value={item.name}>
                      {item.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : (
              <p className="text-sm text-sachi-fg-muted">
                No submit-ready branches found yet.
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-sachi-fg">Title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Pull request title"
                disabled={isFormDisabled}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-sachi-fg">
                Description
              </label>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="What changed?"
                disabled={isFormDisabled}
              />
            </div>

            {existingPullRequest ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-sachi-fg-muted">
                <Badge variant="outline">
                  {existingPullRequest.draft
                    ? "draft"
                    : existingPullRequest.state}
                </Badge>
                <span>PR #{existingPullRequest.number}</span>
                <span>
                  updated {formatRelativeTime(existingPullRequest.updated_at)}
                </span>
              </div>
            ) : null}

            {savePullRequest.error ? (
              <p className="text-sm text-red-500">
                {savePullRequest.error.message}
              </p>
            ) : null}

            {hasClosedPullRequest ? (
              <p className="text-sm text-sachi-fg-muted">
                This branch already has a closed pull request. Reopen or review
                the existing PR instead of creating a new one.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <span className="text-xs text-sachi-fg-muted">
              Base: `{repository.default_branch}`
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={
                  isFormDisabled ||
                  title.trim().length === 0 ||
                  savePullRequest.isPending
                }
                onClick={() => onSave(true)}
              >
                {existingPullRequest?.draft ? "Update draft" : "Save draft"}
              </Button>
              <Button
                disabled={
                  isFormDisabled ||
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
            <CardDescription>Existing PRs for this repository.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openPullRequests.length === 0 ? (
              <p className="text-sm text-sachi-fg-muted">
                No open pull requests.
              </p>
            ) : (
              openPullRequests.map((pullRequest) => (
                <Link
                  key={pullRequest.id}
                  href={`/repo/${repository.owner.login}/${repository.name}/pull/${String(pullRequest.number)}`}
                  className="block rounded-lg border border-sachi-line-subtle p-3 text-sm hover:bg-sachi-fill"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sachi-fg">
                      {pullRequest.title}
                    </span>
                    {pullRequest.draft ? (
                      <Badge variant="outline">draft</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sachi-fg-muted">
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

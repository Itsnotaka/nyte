"use client";

import { DIFF_SETTINGS_DEFAULTS } from "@sachikit/db/schema/settings";
import type { DiffSettingsJson } from "@sachikit/db/schema/settings";
import type { GitHubPullRequestReviewComment, GitHubRepository } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import {
  getPullRequestDiffFileOptions,
  getPullRequestDiffSummaryOptions,
  type PullRequestDiffSummaryFile,
} from "~/lib/github/pull-request-diff";
import { review } from "~/lib/trpc/pr-batch";
import { useTRPC } from "~/lib/trpc/react";

import { useDeferredVisibility } from "../../_components/use-deferred-visibility";
import { DiffFile } from "./diff-file";
import { DiffSettingsPopover } from "./diff-settings-popover";
import { FileTreeSidebar } from "./file-tree-sidebar";
import { Section } from "./layout-sections";
import type { DraftComment, PullRequestQueryInput } from "./types";
import { groupByPath } from "./utils";

type DiffIdentity = {
  owner: string;
  repo: string;
  pullNumber: number;
  baseSha: string;
  headSha: string;
};

type PullRequestDiffSectionProps = {
  activeFile: string | null;
  baseSha: string;
  draftsByFile: Map<string, DraftComment[]>;
  headSha: string;
  onAddDraft: (path: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
  onFileSelect: (filename: string) => void;
  queryInput: PullRequestQueryInput;
  repository: GitHubRepository;
  sidebarOpen: boolean;
};

function DiffFileSkeleton({ file }: { file: PullRequestDiffSummaryFile }) {
  return (
    <div className="overflow-hidden rounded-lg bg-sachi-base ring-1 ring-sachi-line-subtle">
      <div className="flex items-center justify-between gap-3 border-b border-sachi-line-subtle px-4 py-3">
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <span className="text-xs text-sachi-fg-faint">
            {file.additions + file.deletions} changed lines
          </span>
        </div>
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    </div>
  );
}

function DiffFileError({
  file,
  error,
  onRetry,
}: {
  file: PullRequestDiffSummaryFile;
  error: unknown;
  onRetry: () => void;
}) {
  const message = error instanceof Error ? error.message : "Unknown error";

  return (
    <div className="overflow-hidden rounded-lg bg-sachi-base ring-1 ring-destructive/30">
      <div className="space-y-3 px-4 py-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-sachi-fg">{file.name}</p>
          <p className="text-sm text-destructive">Unable to load this file diff.</p>
          <p className="text-xs text-sachi-fg-muted">{message}</p>
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function PullRequestDiffFileSlot({
  activeFile,
  diffIdentity,
  diffSettings,
  drafts,
  file,
  onAddDraft,
  onDraftChange,
  onDraftRemove,
  repository,
  reviewComments,
}: {
  activeFile: string | null;
  diffIdentity: DiffIdentity;
  diffSettings: DiffSettingsJson;
  drafts: DraftComment[];
  file: PullRequestDiffSummaryFile;
  onAddDraft: (path: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
  repository: GitHubRepository;
  reviewComments: GitHubPullRequestReviewComment[];
}) {
  const { hasBeenVisible, ref } = useDeferredVisibility<HTMLDivElement>();
  const shouldLoad = activeFile === file.name || hasBeenVisible;
  const fileQuery = useQuery({
    ...getPullRequestDiffFileOptions({ ...diffIdentity, path: file.name }),
    enabled: shouldLoad,
  });

  return (
    <div ref={ref} className="scroll-mt-4" data-file-name={file.name}>
      {fileQuery.isError ? (
        <DiffFileError
          error={fileQuery.error}
          file={file}
          onRetry={() => void fileQuery.refetch()}
        />
      ) : fileQuery.data ? (
        <DiffFile
          diffSettings={diffSettings}
          drafts={drafts}
          file={fileQuery.data.file}
          onAddDraft={onAddDraft}
          onDraftChange={onDraftChange}
          onDraftRemove={onDraftRemove}
          repository={repository}
          reviewComments={reviewComments}
        />
      ) : (
        <DiffFileSkeleton file={file} />
      )}
    </div>
  );
}

export function PullRequestDiffFallback() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-12" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="rounded-lg border border-sachi-line-subtle bg-sachi-base px-4 py-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      </div>
      <div className="rounded-lg border border-sachi-line-subtle bg-sachi-base px-4 py-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function SidebarStatusFallback() {
  return (
    <div className="space-y-2 py-2">
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function PullRequestDiffSection({
  activeFile,
  baseSha,
  draftsByFile,
  headSha,
  onAddDraft,
  onDraftChange,
  onDraftRemove,
  onFileSelect,
  queryInput,
  repository,
  sidebarOpen,
}: PullRequestDiffSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const diffSettingsQuery = useSuspenseQuery(trpc.settings.getDiffSettings.queryOptions());
  const viewedFilesQuery = useSuspenseQuery(
    trpc.settings.getViewedFiles.queryOptions(queryInput, {
      staleTime: 5 * 60_000,
    }),
  );
  const diffIdentity: DiffIdentity = {
    owner: queryInput.owner,
    repo: queryInput.repo,
    pullNumber: queryInput.pullNumber,
    baseSha,
    headSha,
  };
  const diffSummaryQuery = useSuspenseQuery(getPullRequestDiffSummaryOptions(diffIdentity));
  const comments = review(queryInput, { staleTime: 60_000 });
  const reviewCommentsQuery = useSuspenseQuery(
    trpc.github.getPullRequestReviewComments.queryOptions(comments.input, comments.opts),
  );

  const diffSettings: DiffSettingsJson = diffSettingsQuery.data ?? DIFF_SETTINGS_DEFAULTS;
  const summaryFiles = diffSummaryQuery.data.files;
  const viewedFiles = new Set(viewedFilesQuery.data ?? []);
  const viewedFilesQueryKey = trpc.settings.getViewedFiles.queryKey({
    owner: queryInput.owner,
    pullNumber: queryInput.pullNumber,
    repo: queryInput.repo,
  });

  const markViewed = useMutation(
    trpc.settings.markFileViewed.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: viewedFilesQueryKey });
        const previous = queryClient.getQueryData(viewedFilesQueryKey);
        queryClient.setQueryData(viewedFilesQueryKey, (old: string[] | undefined) => [
          ...(old ?? []),
          variables.filePath,
        ]);
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(viewedFilesQueryKey, context.previous);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: viewedFilesQueryKey });
      },
    }),
  );

  const markUnviewed = useMutation(
    trpc.settings.markFileUnviewed.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: viewedFilesQueryKey });
        const previous = queryClient.getQueryData(viewedFilesQueryKey);
        queryClient.setQueryData(viewedFilesQueryKey, (old: string[] | undefined) =>
          (old ?? []).filter((filePath) => filePath !== variables.filePath),
        );
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(viewedFilesQueryKey, context.previous);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: viewedFilesQueryKey });
      },
    }),
  );

  function handleToggleViewed(filename: string, viewed: boolean) {
    if (viewed) {
      markViewed.mutate({
        filePath: filename,
        owner: queryInput.owner,
        pullNumber: queryInput.pullNumber,
        repo: queryInput.repo,
      });
      return;
    }

    markUnviewed.mutate({
      filePath: filename,
      owner: queryInput.owner,
      pullNumber: queryInput.pullNumber,
      repo: queryInput.repo,
    });
  }

  const reviewCommentsByFile = React.useMemo(
    () => groupByPath(reviewCommentsQuery.data.filter((comment) => comment.line !== null)),
    [reviewCommentsQuery.data],
  );

  const fileEntries = React.useMemo(
    () =>
      summaryFiles.map((file) => ({
        additions: file.additions,
        deletions: file.deletions,
        filename: file.name,
        status: file.type,
      })),
    [summaryFiles],
  );

  return (
    <div className="flex gap-6">
      {sidebarOpen ? (
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-0">
            <FileTreeSidebar
              activeFile={activeFile}
              files={fileEntries}
              onFileSelect={onFileSelect}
              onToggleViewed={handleToggleViewed}
              viewedFiles={viewedFiles}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-6">
        <Section
          action={
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {summaryFiles.length} file{summaryFiles.length === 1 ? "" : "s"}
              </Badge>
              <DiffSettingsPopover />
            </div>
          }
          title="Diff"
        >
          {summaryFiles.length === 0 ? (
            <p className="text-sm text-sachi-fg-muted">No files changed in this pull request.</p>
          ) : (
            <div className="space-y-4">
              {summaryFiles.map((file) => (
                <PullRequestDiffFileSlot
                  key={file.name}
                  activeFile={activeFile}
                  diffIdentity={diffIdentity}
                  diffSettings={diffSettings}
                  drafts={draftsByFile.get(file.name) ?? []}
                  file={file}
                  onAddDraft={onAddDraft}
                  onDraftChange={onDraftChange}
                  onDraftRemove={onDraftRemove}
                  repository={repository}
                  reviewComments={reviewCommentsByFile.get(file.name) ?? []}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

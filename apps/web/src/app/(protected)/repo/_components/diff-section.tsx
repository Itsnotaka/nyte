"use client";

import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { DIFF_SETTINGS_DEFAULTS } from "@sachikit/db/schema/settings";
import type { DiffSettingsJson } from "@sachikit/db/schema/settings";
import type { GitHubPullRequestFile, GitHubRepository } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { useMutation, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC, useTRPCClient } from "~/lib/trpc/react";

import { DiffFile } from "./diff-file";
import { DiffSettingsPopover } from "./diff-settings-popover";
import { FileTreeSidebar } from "./file-tree-sidebar";
import { Section } from "./layout-sections";
import type { DraftComment, PullRequestQueryInput } from "./types";
import { groupByPath } from "./utils";

const INITIAL_DIFF_PAGE_SIZE = 1;
const FOLLOW_UP_DIFF_PAGE_SIZE = 100;

function buildPatchHeader(file: GitHubPullRequestFile): string {
  const previousName = file.previous_filename ?? file.filename;
  const fromPath = file.status === "added" ? "/dev/null" : `a/${previousName}`;
  const toPath = file.status === "removed" ? "/dev/null" : `b/${file.filename}`;
  return `diff --git a/${previousName} b/${file.filename}\n--- ${fromPath}\n+++ ${toPath}\n`;
}

function parsePullRequestFile(file: GitHubPullRequestFile): FileDiffMetadata | null {
  const diff = `${buildPatchHeader(file)}${file.patch ? `${file.patch}\n` : ""}`;
  const parsed = parsePatchFiles(diff).flatMap((patch) => patch.files);
  return parsed[0] ?? null;
}

type PullRequestDiffSectionProps = {
  activeFile: string | null;
  draftsByFile: Map<string, DraftComment[]>;
  onAddDraft: (path: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
  onFileSelect: (filename: string) => void;
  queryInput: PullRequestQueryInput;
  repository: GitHubRepository;
  sidebarOpen: boolean;
};

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
  draftsByFile,
  onAddDraft,
  onDraftChange,
  onDraftRemove,
  onFileSelect,
  queryInput,
  repository,
  sidebarOpen,
}: PullRequestDiffSectionProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const diffSettingsQuery = useSuspenseQuery(trpc.settings.getDiffSettings.queryOptions());
  const viewedFilesQuery = useSuspenseQuery(
    trpc.settings.getViewedFiles.queryOptions(queryInput, {
      staleTime: 5 * 60_000,
    }),
  );
  const firstPageQuery = useSuspenseQuery(
    trpc.github.getPullRequestFiles.queryOptions(
      { ...queryInput, page: 1, perPage: INITIAL_DIFF_PAGE_SIZE },
      { staleTime: 60_000 },
    ),
  );
  const reviewCommentsQuery = useSuspenseQuery(
    trpc.github.getPullRequestReviewComments.queryOptions(queryInput, {
      staleTime: 60_000,
    }),
  );

  const diffSettings: DiffSettingsJson = diffSettingsQuery.data ?? DIFF_SETTINGS_DEFAULTS;
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

  const resolvedBulkPagesQuery = useQuery({
    enabled: firstPageQuery.data.nextPage !== null,
    queryKey: [
      "github",
      "getPullRequestFilesRemaining",
      queryInput.owner,
      queryInput.repo,
      queryInput.pullNumber,
      firstPageQuery.data.nextPage,
      FOLLOW_UP_DIFF_PAGE_SIZE,
    ],
    queryFn: async () => {
      const pages = [];
      let nextPage = firstPageQuery.data.nextPage;
      while (nextPage !== null) {
        const page = await trpcClient.github.getPullRequestFiles.query({
          ...queryInput,
          page: nextPage,
          perPage: FOLLOW_UP_DIFF_PAGE_SIZE,
        });
        pages.push(page);
        nextPage = page.nextPage;
      }
      return pages;
    },
    staleTime: 60_000,
  });

  const sourceFiles = React.useMemo(() => {
    const fileMap = new Map<string, GitHubPullRequestFile>();
    const pages = resolvedBulkPagesQuery.data
      ? [firstPageQuery.data, ...resolvedBulkPagesQuery.data]
      : [firstPageQuery.data];
    for (const page of pages) {
      for (const file of page.files) {
        fileMap.set(`${file.filename}:${file.sha}`, file);
      }
    }
    return Array.from(fileMap.values());
  }, [firstPageQuery.data, resolvedBulkPagesQuery.data]);

  const files = React.useMemo(
    () =>
      sourceFiles.flatMap((file) => {
        const parsed = parsePullRequestFile(file);
        return parsed ? [parsed] : [];
      }),
    [sourceFiles],
  );

  const reviewCommentsByFile = React.useMemo(
    () => groupByPath(reviewCommentsQuery.data.filter((c) => c.line !== null)),
    [reviewCommentsQuery.data],
  );

  const fileEntries = sourceFiles.map((file) => ({
    additions: file.additions,
    deletions: file.deletions,
    filename: file.filename,
    status: file.status,
  }));

  const isLoadingMoreFiles = resolvedBulkPagesQuery.isLoading || resolvedBulkPagesQuery.isFetching;

  return (
    <div className="flex gap-6">
      {sidebarOpen ? (
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-0">
            <FileTreeSidebar
              files={fileEntries}
              viewedFiles={viewedFiles}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              onToggleViewed={handleToggleViewed}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-6">
        <Section
          title="Diff"
          action={
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {sourceFiles.length} file{sourceFiles.length === 1 ? "" : "s"}
              </Badge>
              <DiffSettingsPopover />
            </div>
          }
        >
          {files.length === 0 ? (
            <p className="text-sm text-sachi-fg-muted">No files changed in this pull request.</p>
          ) : (
            <div className="space-y-4">
              {files.map((file) => (
                <DiffFile
                  key={`${file.name}:${file.newObjectId ?? file.prevObjectId ?? file.mode ?? "file"}`}
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
              {isLoadingMoreFiles ? (
                <div className="rounded-lg border border-sachi-line-subtle bg-sachi-base px-4 py-3 text-sm text-sachi-fg-muted">
                  Loading more files…
                </div>
              ) : null}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

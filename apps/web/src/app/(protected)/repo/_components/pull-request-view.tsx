"use client";

import { parsePatchFiles } from "@pierre/diffs";
import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { FileDiff } from "@pierre/diffs/react";
import { DIFF_SETTINGS_DEFAULTS } from "@sachikit/db/schema/settings";
import type { DiffSettingsJson } from "@sachikit/db/schema/settings";
import type {
  GitHubLabel,
  GitHubPullRequestReview,
  GitHubPullRequestReviewComment,
  GitHubRepository,
} from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { ButtonGroup } from "@sachikit/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sachikit/ui/components/dropdown-menu";
import { Input } from "@sachikit/ui/components/input";
import {
  LayerCard,
  LayerCardPrimary,
  LayerCardSecondary,
} from "@sachikit/ui/components/layer-card";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Textarea } from "@sachikit/ui/components/textarea";
import { cn } from "@sachikit/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { nanoid } from "nanoid";
import * as React from "react";
import { Streamdown } from "streamdown";

import { useTRPC } from "~/lib/trpc/client";
import type { AppRouter } from "~/lib/trpc/router";

import { ChecksPanel } from "./checks-panel";
import { DiffSettingsPopover } from "./diff-settings-popover";
import { FileTreeSidebar } from "./file-tree-sidebar";
import { LabelPanel } from "./label-panel";
import { MergeModal } from "./merge-modal";
import { ReviewerPanel } from "./reviewer-panel";

type PullRequestPageData = NonNullable<
  inferRouterOutputs<AppRouter>["github"]["getPullRequestPage"]
>;

type PullRequestViewProps = {
  initialData: PullRequestPageData;
};

type DraftComment = {
  id: string;
  path: string;
  body: string;
  lineNumber: number;
  side: "LEFT" | "RIGHT";
};

type AnnotationPayload =
  | {
      kind: "existing";
      comment: GitHubPullRequestReviewComment;
    }
  | {
      kind: "draft";
      draft: DraftComment;
    };

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

function annotationSide(side: "LEFT" | "RIGHT"): "deletions" | "additions" {
  return side === "LEFT" ? "deletions" : "additions";
}

function reviewBadge(review: GitHubPullRequestReview): string {
  if (review.state === "APPROVED") return "approved";
  if (review.state === "CHANGES_REQUESTED") return "changes requested";
  if (review.state === "COMMENTED") return "commented";
  return review.state.toLowerCase();
}

function parseFiles(diff: string): FileDiffMetadata[] {
  if (diff.trim().length === 0) return [];
  return parsePatchFiles(diff).flatMap((patch) => patch.files);
}

type MarkdownContentProps = {
  content: string | null;
  repository: GitHubRepository;
  emptyFallback?: string;
  className?: string;
};

function resolveMarkdownUrl(url: string, repository: GitHubRepository): string {
  if (
    url.startsWith("#") ||
    url.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)
  ) {
    return url;
  }

  try {
    const repositoryUrl = `https://github.com/${repository.owner.login}/${repository.name}/`;
    return new URL(url, repositoryUrl).toString();
  } catch {
    return url;
  }
}

function MarkdownContent({
  content,
  repository,
  emptyFallback,
  className,
}: MarkdownContentProps) {
  const markdown = content?.trim() ?? "";

  if (markdown.length === 0) {
    return emptyFallback ? <p className={className}>{emptyFallback}</p> : null;
  }

  return (
    <Streamdown
      className={cn(
        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_p]:mb-2 [&_p]:last:mb-0",
        className,
      )}
      linkSafety={{ enabled: false }}
      mode="static"
      urlTransform={(url) => resolveMarkdownUrl(url, repository)}
    >
      {markdown}
    </Streamdown>
  );
}

type ReviewSurfaceProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

function ReviewSurface({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: ReviewSurfaceProps) {
  return (
    <LayerCard className={className}>
      <LayerCardSecondary className="items-start">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-sachi-fg">{title}</h2>
          {description ? (
            <p className="text-sm font-normal text-sachi-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </LayerCardSecondary>
      <LayerCardPrimary className={contentClassName}>
        {children}
      </LayerCardPrimary>
    </LayerCard>
  );
}

type ReviewEntryProps = {
  author: string;
  body: string | null;
  repository: GitHubRepository;
  meta?: React.ReactNode;
  emptyFallback?: string;
};

function ReviewEntry({
  author,
  body,
  repository,
  meta,
  emptyFallback,
}: ReviewEntryProps) {
  return (
    <LayerCard className="bg-transparent p-0 shadow-none ring-0">
      <LayerCardSecondary className="rounded-lg bg-sachi-surface px-3 py-2 text-xs font-normal text-sachi-fg-muted ring-1 ring-sachi-line-subtle">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-sachi-fg-secondary">{author}</span>
          {meta}
        </div>
      </LayerCardSecondary>
      <LayerCardPrimary className="gap-0">
        <MarkdownContent
          className="pull-request-markdown text-sm text-sachi-fg-secondary"
          content={body}
          emptyFallback={emptyFallback}
          repository={repository}
        />
      </LayerCardPrimary>
    </LayerCard>
  );
}

type ReviewAction = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  APPROVE: "Approve",
  COMMENT: "Comment",
  REQUEST_CHANGES: "Request changes",
};

function canSubmitReview(
  action: ReviewAction,
  reviewBody: string,
  draftCount: number,
): boolean {
  if (action === "APPROVE") return true;
  return reviewBody.trim().length > 0 || draftCount > 0;
}

// --- Inline editable title ---

function EditableTitle({
  title,
  onSave,
  isPending,
}: {
  title: string;
  onSave: (value: string) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title);

  React.useEffect(() => {
    setValue(title);
  }, [title]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== title) {
      onSave(trimmed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        disabled={isPending}
        className="text-lg font-semibold"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      className="text-left text-lg font-semibold text-sachi-fg hover:text-sachi-accent"
      onClick={() => setEditing(true)}
      title="Click to edit title"
    >
      {title}
    </button>
  );
}

// --- Main component ---

export function PullRequestView({ initialData }: PullRequestViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = React.useState<DraftComment[]>([]);
  const [reviewBody, setReviewBody] = React.useState("");
  const [commentBody, setCommentBody] = React.useState("");
  const [reviewAction, setReviewAction] = React.useState<ReviewAction>("COMMENT");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeFile, setActiveFile] = React.useState<string | null>(null);
  const [editingDescription, setEditingDescription] = React.useState(false);
  const [descriptionDraft, setDescriptionDraft] = React.useState("");
  const reviewBodyId = React.useId();
  const commentBodyId = React.useId();
  const diffAreaRef = React.useRef<HTMLDivElement>(null);

  const queryInput = React.useMemo(
    () => ({
      owner: initialData.repository.owner.login,
      pullNumber: initialData.pullRequest.number,
      repo: initialData.repository.name,
    }),
    [
      initialData.pullRequest.number,
      initialData.repository.name,
      initialData.repository.owner.login,
    ],
  );

  const pullRequestPageQueryKey =
    trpc.github.getPullRequestPage.queryKey(queryInput);
  const pullRequestPageQuery = useQuery(
    trpc.github.getPullRequestPage.queryOptions(queryInput, {
      initialData,
      staleTime: 0,
    }),
  );

  const diffSettingsQuery = useQuery(
    trpc.settings.getDiffSettings.queryOptions(),
  );
  const diffSettings: DiffSettingsJson =
    diffSettingsQuery.data ?? DIFF_SETTINGS_DEFAULTS;

  const pageData = pullRequestPageQuery.data ?? initialData;
  const repository = pageData.repository;
  const pullRequest = pageData.pullRequest;
  const issueComments = pageData.issueComments;
  const reviews = pageData.reviews;
  const reviewComments = pageData.reviewComments;
  const files = React.useMemo(() => parseFiles(pageData.diff), [pageData.diff]);

  // Derive labels from the raw page data (they come through on the PR object from GitHub)
  const prLabels: GitHubLabel[] = React.useMemo(() => {
    const raw = (pullRequest as Record<string, unknown>).labels;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((label: unknown) => {
      if (typeof label !== "object" || label === null) return [];
      const l = label as { id?: number; name?: string; color?: string; description?: string | null };
      if (!l.id || !l.name || !l.color) return [];
      return [{ id: l.id, name: l.name, color: l.color, description: l.description ?? null }];
    });
  }, [pullRequest]);

  // Viewed files
  const viewedFilesQuery = useQuery(
    trpc.settings.getViewedFiles.queryOptions(
      { prId: pullRequest.id },
      { staleTime: 0 },
    ),
  );
  const viewedFiles = React.useMemo(
    () => new Set(viewedFilesQuery.data ?? []),
    [viewedFilesQuery.data],
  );
  const viewedFilesQueryKey = trpc.settings.getViewedFiles.queryKey({ prId: pullRequest.id });

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
          (old ?? []).filter((f) => f !== variables.filePath),
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
      markViewed.mutate({ filePath: filename, prId: pullRequest.id });
    } else {
      markUnviewed.mutate({ filePath: filename, prId: pullRequest.id });
    }
  }

  // File select => scroll
  function handleFileSelect(filename: string) {
    setActiveFile(filename);
    const element = diffAreaRef.current?.querySelector(
      `[data-file-name="${CSS.escape(filename)}"]`,
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Keyboard shortcut: F to toggle sidebar
  React.useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (
        event.key === "f" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const pullRequestIdentity = React.useMemo(
    () => ({
      owner: repository.owner.login,
      pullNumber: pullRequest.number,
      repo: repository.name,
    }),
    [pullRequest.number, repository.name, repository.owner.login],
  );

  const isOpen = pullRequest.state === "open" && !pullRequest.merged;
  const isMerged = pullRequest.merged;

  const addComment = useMutation(
    trpc.github.addPullRequestComment.mutationOptions({
      onSuccess: async () => {
        setCommentBody("");
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  const submitReview = useMutation(
    trpc.github.submitPullRequestReview.mutationOptions({
      onSuccess: async () => {
        setDrafts([]);
        setReviewBody("");
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  const merge = useMutation(
    trpc.github.mergePullRequest.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  // Phase 4: Update PR mutation
  const updatePR = useMutation(
    trpc.github.updatePullRequest.mutationOptions({
      onSuccess: async () => {
        setEditingDescription(false);
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  // Phase 4: Convert to ready mutation
  const convertToReady = useMutation(
    trpc.github.convertToReady.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  function addDraft(path: string, lineNumber: number, side: "LEFT" | "RIGHT") {
    setDrafts((current) => {
      const exists = current.some(
        (draft) =>
          draft.path === path &&
          draft.lineNumber === lineNumber &&
          draft.side === side,
      );
      if (exists) return current;
      return [
        ...current,
        { body: "", id: nanoid(), lineNumber, path, side },
      ];
    });
  }

  function updateDraft(id: string, body: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, body } : draft)),
    );
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  function onSubmitReview(event: ReviewAction) {
    const comments = drafts
      .filter((draft) => draft.body.trim().length > 0)
      .map((draft) => ({
        body: draft.body.trim(),
        line: draft.lineNumber,
        path: draft.path,
        side: draft.side,
      }));

    void submitReview.mutateAsync({
      ...pullRequestIdentity,
      body: reviewBody.trim().length > 0 ? reviewBody.trim() : undefined,
      comments: comments.length > 0 ? comments : undefined,
      event,
    });
  }

  function isShortcutSubmit(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    return (event.metaKey || event.ctrlKey) && event.key === "Enter";
  }

  function onAddComment() {
    void addComment.mutateAsync({
      ...pullRequestIdentity,
      body: commentBody.trim(),
    });
  }

  function onMerge(options: {
    mergeMethod: "merge" | "squash" | "rebase";
    commitTitle: string;
    commitMessage: string;
  }) {
    void merge.mutateAsync({
      ...pullRequestIdentity,
      commitMessage: options.commitMessage || undefined,
      commitTitle: options.commitTitle || undefined,
      mergeMethod: options.mergeMethod,
    });
  }

  function handleSaveTitle(title: string) {
    updatePR.mutate({
      ...pullRequestIdentity,
      body: pullRequest.body ?? "",
      title,
    });
  }

  function handleStartEditDescription() {
    setDescriptionDraft(pullRequest.body ?? "");
    setEditingDescription(true);
  }

  function handleSaveDescription() {
    updatePR.mutate({
      ...pullRequestIdentity,
      body: descriptionDraft,
      title: pullRequest.title,
    });
  }

  const reviewSubmitDisabled =
    submitReview.isPending ||
    !canSubmitReview(reviewAction, reviewBody, drafts.length);

  // File entries for sidebar
  const fileEntries = React.useMemo(
    () =>
      files.map((file) => ({
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        filename: file.name,
        status: file.mode ?? "modified",
      })),
    [files],
  );

  return (
    <div className="flex h-full min-h-0">
      {sidebarOpen ? (
        <FileTreeSidebar
          files={fileEntries}
          viewedFiles={viewedFiles}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onToggleViewed={handleToggleViewed}
        />
      ) : null}

      <div ref={diffAreaRef} className="min-w-0 flex-1 overflow-auto">
        <InsetView maxWidth="xl">
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isOpen ? (
                    <EditableTitle
                      title={pullRequest.title}
                      onSave={handleSaveTitle}
                      isPending={updatePR.isPending}
                    />
                  ) : (
                    <h1 className="text-lg font-semibold text-sachi-fg">
                      {pullRequest.title}
                    </h1>
                  )}
                  <Badge variant="outline">#{pullRequest.number}</Badge>
                  {pullRequest.draft ? <Badge variant="outline">draft</Badge> : null}
                  {isMerged ? (
                    <Badge variant="outline">merged</Badge>
                  ) : pullRequest.state === "closed" ? (
                    <Badge variant="outline">closed</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-sachi-fg-muted">
                  {pullRequest.head.ref} to {pullRequest.base.ref} · updated{" "}
                  {formatUpdated(pullRequest.updated_at)}
                </p>
              </div>

              {isOpen ? (
                <div className="flex items-center gap-2">
                  {pullRequest.draft ? (
                    <Button
                      variant="outline"
                      type="button"
                      disabled={convertToReady.isPending}
                      onClick={() => convertToReady.mutate(pullRequestIdentity)}
                    >
                      {convertToReady.isPending ? "Publishing..." : "Ready for review"}
                    </Button>
                  ) : null}
                  {merge.error ? (
                    <p className="text-sm text-red-500">{merge.error.message}</p>
                  ) : null}
                  <MergeModal
                    pullTitle={pullRequest.title}
                    pullBody={pullRequest.body}
                    pullNumber={pullRequest.number}
                    owner={repository.owner.login}
                    repo={repository.name}
                    headSha={pullRequest.head.sha}
                    disabled={merge.isPending}
                    isPending={merge.isPending}
                    onMerge={onMerge}
                    trigger={
                      <Button type="button" disabled={merge.isPending}>
                        {merge.isPending ? "Merging..." : "Merge"}
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <ReviewSurface
                title="Description"
                action={
                  isOpen && !editingDescription ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEditDescription}
                    >
                      Edit
                    </Button>
                  ) : null
                }
                contentClassName="gap-0"
              >
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descriptionDraft}
                      onChange={(event) =>
                        setDescriptionDraft(event.target.value)
                      }
                      rows={8}
                      disabled={updatePR.isPending}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDescription(false)}
                        disabled={updatePR.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDescription}
                        disabled={updatePR.isPending}
                      >
                        {updatePR.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <MarkdownContent
                    className="pull-request-markdown text-sm text-sachi-fg-secondary"
                    content={pullRequest.body}
                    emptyFallback="No description provided."
                    repository={repository}
                  />
                )}
              </ReviewSurface>

              {isOpen ? (
                <ReviewSurface
                  title="Review"
                  action={
                    drafts.length > 0 ? (
                      <Badge variant="outline">
                        {drafts.length} pending draft{drafts.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null
                  }
                  contentClassName="gap-3"
                >
                  <Textarea
                    id={reviewBodyId}
                    value={reviewBody}
                    onChange={(event) => setReviewBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (!isShortcutSubmit(event) || reviewSubmitDisabled) return;
                      event.preventDefault();
                      onSubmitReview(reviewAction);
                    }}
                    disabled={submitReview.isPending}
                    placeholder="Leave a review comment..."
                    rows={3}
                  />
                  {submitReview.error ? (
                    <p className="text-sm text-red-500">
                      {submitReview.error.message}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
                    <ButtonGroup>
                      <Button
                        type="button"
                        disabled={reviewSubmitDisabled}
                        onClick={() => onSubmitReview(reviewAction)}
                      >
                        {REVIEW_ACTION_LABELS[reviewAction]}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              size="icon"
                              disabled={submitReview.isPending}
                              aria-label="Choose review action"
                            />
                          }
                        >
                          <ChevronDownIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4}>
                          <DropdownMenuItem onClick={() => setReviewAction("COMMENT")}>
                            <div>
                              <p className="text-sm font-medium">Comment</p>
                              <p className="text-xs text-sachi-fg-muted">General feedback</p>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReviewAction("APPROVE")}>
                            <div>
                              <p className="text-sm font-medium">Approve</p>
                              <p className="text-xs text-sachi-fg-muted">Approve this PR</p>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReviewAction("REQUEST_CHANGES")}>
                            <div>
                              <p className="text-sm font-medium">Request changes</p>
                              <p className="text-xs text-sachi-fg-muted">Ask for revisions</p>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ButtonGroup>
                  </div>
                </ReviewSurface>
              ) : null}

              <ReviewSurface
                title="Diff"
                action={
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {files.length} file{files.length === 1 ? "" : "s"}
                    </Badge>
                    <DiffSettingsPopover />
                  </div>
                }
                contentClassName="gap-4"
              >
                {files.length === 0 ? (
                  <p className="text-sm text-sachi-fg-muted">
                    No files changed in this pull request.
                  </p>
                ) : (
                  files.map((file) => (
                    <DiffFile
                      key={`${file.name}:${file.newObjectId ?? file.prevObjectId ?? file.mode ?? "file"}`}
                      diffSettings={diffSettings}
                      drafts={drafts.filter((draft) => draft.path === file.name)}
                      file={file}
                      onAddDraft={addDraft}
                      onDraftChange={updateDraft}
                      onDraftRemove={removeDraft}
                      repository={repository}
                      reviewComments={reviewComments.filter(
                        (comment) =>
                          comment.path === file.name && comment.line !== null,
                      )}
                    />
                  ))
                )}
              </ReviewSurface>
            </div>

            <div className="space-y-4">
              {/* Phase 2: Checks panel */}
              <LayerCard>
                <ChecksPanel
                  owner={repository.owner.login}
                  repo={repository.name}
                  headSha={pullRequest.head.sha}
                />
              </LayerCard>

              {/* Phase 4: Reviewers */}
              <LayerCard>
                <LayerCardPrimary>
                  <ReviewerPanel
                    owner={repository.owner.login}
                    repo={repository.name}
                    pullNumber={pullRequest.number}
                    requestedReviewers={pullRequest.requested_reviewers}
                    pullRequestPageQueryKey={pullRequestPageQueryKey}
                  />
                </LayerCardPrimary>
              </LayerCard>

              {/* Phase 4: Labels */}
              <LayerCard>
                <LayerCardPrimary>
                  <LabelPanel
                    owner={repository.owner.login}
                    repo={repository.name}
                    pullNumber={pullRequest.number}
                    currentLabels={prLabels}
                    pullRequestPageQueryKey={pullRequestPageQueryKey}
                  />
                </LayerCardPrimary>
              </LayerCard>

              <ReviewSurface title="Comment" contentClassName="gap-0">
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (commentBody.trim().length === 0 || addComment.isPending) return;
                    onAddComment();
                  }}
                >
                  <Textarea
                    id={commentBodyId}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (!isShortcutSubmit(event)) return;
                      event.preventDefault();
                      if (commentBody.trim().length === 0 || addComment.isPending) return;
                      onAddComment();
                    }}
                    disabled={addComment.isPending}
                    placeholder="Leave a comment..."
                    rows={3}
                  />
                  {addComment.error ? (
                    <p className="text-sm text-red-500">
                      {addComment.error.message}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={
                        commentBody.trim().length === 0 || addComment.isPending
                      }
                    >
                      Comment
                    </Button>
                  </div>
                </form>
              </ReviewSurface>

              <ReviewSurface title="Discussion" contentClassName="gap-3">
                {issueComments.length === 0 ? (
                  <p className="text-sm text-sachi-fg-muted">
                    No comments yet.
                  </p>
                ) : (
                  issueComments.map((comment) => (
                    <ReviewEntry
                      key={comment.id}
                      author={comment.user.login}
                      body={comment.body}
                      meta={<span>{formatUpdated(comment.updated_at)}</span>}
                      repository={repository}
                    />
                  ))
                )}
              </ReviewSurface>

              <ReviewSurface title="Reviews" contentClassName="gap-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-sachi-fg-muted">No reviews yet.</p>
                ) : (
                  reviews.map((review) => (
                    <ReviewEntry
                      key={review.id}
                      author={review.user.login}
                      body={review.body}
                      emptyFallback="No summary."
                      meta={
                        <>
                          <Badge variant="outline">{reviewBadge(review)}</Badge>
                          {review.submitted_at ? (
                            <span>{formatUpdated(review.submitted_at)}</span>
                          ) : null}
                        </>
                      }
                      repository={repository}
                    />
                  ))
                )}
              </ReviewSurface>
            </div>
          </div>
        </InsetView>
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type DiffFileProps = {
  file: FileDiffMetadata;
  repository: GitHubRepository;
  reviewComments: GitHubPullRequestReviewComment[];
  drafts: DraftComment[];
  diffSettings: DiffSettingsJson;
  onAddDraft: (
    path: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT",
  ) => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
};

function DiffFile({
  file,
  repository,
  reviewComments,
  drafts,
  diffSettings,
  onAddDraft,
  onDraftChange,
  onDraftRemove,
}: DiffFileProps) {
  const publishedCommentCount = reviewComments.length;
  const draftCommentCount = drafts.length;

  const annotations = React.useMemo<
    DiffLineAnnotation<AnnotationPayload>[]
  >(() => {
    if (diffSettings.hideComments) return [];

    const existing: DiffLineAnnotation<AnnotationPayload>[] =
      reviewComments.flatMap((comment) => {
        if (comment.line == null || comment.side == null) return [];
        return [
          {
            lineNumber: comment.line,
            metadata: { comment, kind: "existing" as const },
            side: annotationSide(comment.side),
          },
        ];
      });

    const pending: DiffLineAnnotation<AnnotationPayload>[] = drafts.map(
      (draft) => ({
        lineNumber: draft.lineNumber,
        metadata: { draft, kind: "draft" as const },
        side: annotationSide(draft.side),
      }),
    );

    return [...existing, ...pending];
  }, [drafts, reviewComments, diffSettings.hideComments]);

  return (
    <div
      className="overflow-hidden rounded-lg ring-1 ring-sachi-line"
      data-file-name={file.name}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sachi-line bg-sachi-fill px-3 py-2">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-semibold text-sachi-fg">
            {file.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publishedCommentCount > 0 ? (
            <Badge variant="outline">{publishedCommentCount} published</Badge>
          ) : null}
          {draftCommentCount > 0 ? (
            <Badge variant="outline">
              {draftCommentCount} draft{draftCommentCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </div>
      <FileDiff
        className="w-full"
        fileDiff={file}
        options={{
          collapsedContextThreshold: diffSettings.contextLines,
          diffStyle: diffSettings.diffStyle,
          enableGutterUtility: true,
          lineDiffType: diffSettings.lineDiffType,
          onGutterUtilityClick: (range) => {
            const side = range.side === "deletions" ? "LEFT" : "RIGHT";
            onAddDraft(file.name, range.start, side);
          },
          overflow: diffSettings.overflow,
          theme: {
            dark: "github-dark",
            light: "github-light",
          },
          unsafeCSS: "pre { font-size: 13px; }",
        }}
        lineAnnotations={annotations}
        renderAnnotation={(annotation) => {
          const meta = annotation.metadata;
          if (meta.kind === "existing") {
            return (
              <div className="max-w-2xl space-y-1.5 p-2">
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sachi-surface px-3 py-2 text-xs font-normal text-sachi-fg-muted ring-1 ring-sachi-line-subtle">
                  <span className="font-medium text-sachi-fg-secondary">
                    {meta.comment.user.login}
                  </span>
                  <Badge variant="outline">Published</Badge>
                  <span>{formatUpdated(meta.comment.updated_at)}</span>
                </div>
                <div className="rounded-lg bg-sachi-base px-3 py-3 ring-1 ring-sachi-line">
                  <MarkdownContent
                    className="pull-request-markdown text-sm text-sachi-fg-secondary"
                    content={meta.comment.body}
                    emptyFallback="No comment body."
                    repository={repository}
                  />
                </div>
              </div>
            );
          }

          const draftFieldId = `draft-${meta.draft.id}`;

          return (
            <div className="max-w-2xl space-y-1.5 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sachi-surface px-3 py-2 ring-1 ring-sachi-line-subtle">
                <div className="flex flex-wrap items-center gap-2 text-xs font-normal text-sachi-fg-muted">
                  <span className="font-medium text-sachi-fg-secondary">
                    Draft comment
                  </span>
                  <Badge variant="outline">Pending</Badge>
                  <span>Line {meta.draft.lineNumber}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDraftRemove(meta.draft.id)}
                >
                  Remove
                </Button>
              </div>
              <div className="rounded-lg bg-sachi-base px-3 py-3 ring-1 ring-sachi-line">
                <div className="space-y-2">
                  <label
                    htmlFor={draftFieldId}
                    className="text-sm font-medium text-sachi-fg"
                  >
                    Inline feedback
                  </label>
                  <Textarea
                    id={draftFieldId}
                    value={meta.draft.body}
                    onChange={(event) =>
                      onDraftChange(meta.draft.id, event.target.value)
                    }
                    placeholder="Explain what should change or why this looks good."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

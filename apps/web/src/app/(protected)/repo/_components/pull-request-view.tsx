"use client";

import { parsePatchFiles } from "@pierre/diffs";
import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { FileDiff } from "@pierre/diffs/react";
import type {
  GitHubPullRequestReview,
  GitHubPullRequestReviewComment,
  GitHubRepository,
} from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  LayerCard,
  LayerCardPrimary,
  LayerCardSecondary,
} from "@sachikit/ui/components/layer-card";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Textarea } from "@sachikit/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { nanoid } from "nanoid";
import * as React from "react";
import { Streamdown } from "streamdown";

import { useTRPC } from "~/lib/trpc/client";
import type { AppRouter } from "~/lib/trpc/router";

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
  if (diff.trim().length === 0) {
    return [];
  }

  return parsePatchFiles(diff).flatMap((patch) => patch.files);
}

type MarkdownContentProps = {
  content: string | null;
  repository: GitHubRepository;
  emptyFallback?: string;
  className?: string;
};

function resolveMarkdownUrl(url: string, repository: GitHubRepository): string {
  if (url.startsWith("#") || url.startsWith("//") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) {
    return url;
  }

  try {
    const repositoryUrl = `https://github.com/${repository.owner.login}/${repository.name}/`;
    return new URL(url, repositoryUrl).toString();
  } catch {
    return url;
  }
}

function MarkdownContent({ content, repository, emptyFallback, className }: MarkdownContentProps) {
  const markdown = content?.trim() ?? "";

  if (markdown.length === 0) {
    return emptyFallback ? <p className={className}>{emptyFallback}</p> : null;
  }

  return (
    <Streamdown
      className={className}
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
            <p className="text-sm font-normal text-sachi-fg-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </LayerCardSecondary>
      <LayerCardPrimary className={contentClassName}>{children}</LayerCardPrimary>
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

function ReviewEntry({ author, body, repository, meta, emptyFallback }: ReviewEntryProps) {
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

export function PullRequestView({ initialData }: PullRequestViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = React.useState<DraftComment[]>([]);
  const [reviewBody, setReviewBody] = React.useState("");
  const [commentBody, setCommentBody] = React.useState("");
  const reviewBodyId = React.useId();
  const reviewBodyHelpId = React.useId();
  const commentBodyId = React.useId();
  const commentBodyHelpId = React.useId();

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

  const pullRequestPageQueryKey = trpc.github.getPullRequestPage.queryKey(queryInput);
  const pullRequestPageQuery = useQuery(
    trpc.github.getPullRequestPage.queryOptions(queryInput, {
      initialData,
      staleTime: 0,
    }),
  );

  const pageData = pullRequestPageQuery.data ?? initialData;
  const repository = pageData.repository;
  const pullRequest = pageData.pullRequest;
  const issueComments = pageData.issueComments;
  const reviews = pageData.reviews;
  const reviewComments = pageData.reviewComments;
  const files = React.useMemo(() => parseFiles(pageData.diff), [pageData.diff]);

  const pullRequestIdentity = React.useMemo(
    () => ({
      owner: repository.owner.login,
      pullNumber: pullRequest.number,
      repo: repository.name,
    }),
    [pullRequest.number, repository.name, repository.owner.login],
  );

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

  function addDraft(path: string, lineNumber: number, side: "LEFT" | "RIGHT") {
    setDrafts((current) => {
      const exists = current.some(
        (draft) => draft.path === path && draft.lineNumber === lineNumber && draft.side === side,
      );
      if (exists) {
        return current;
      }

      return [
        ...current,
        {
          body: "",
          id: nanoid(),
          lineNumber,
          path,
          side,
        },
      ];
    });
  }

  function updateDraft(id: string, body: string) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, body } : draft)));
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  function onSubmitReview(event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") {
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

  return (
    <InsetView maxWidth="xl">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-sachi-fg">{pullRequest.title}</h1>
          <Badge variant="outline">#{pullRequest.number}</Badge>
          {pullRequest.draft ? <Badge variant="outline">draft</Badge> : null}
        </div>
        <p className="text-sm text-sachi-fg-muted">
          {pullRequest.head.ref} to {pullRequest.base.ref} · updated{" "}
          {formatUpdated(pullRequest.updated_at)}
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ReviewSurface title="Description" contentClassName="gap-0">
            <MarkdownContent
              className="pull-request-markdown text-sm text-sachi-fg-secondary"
              content={pullRequest.body}
              emptyFallback="No description provided."
              repository={repository}
            />
          </ReviewSurface>

          <ReviewSurface
            title="Review"
            description="Submit general feedback or include any pending inline comments."
            action={
              drafts.length > 0 ? (
                <Badge variant="outline">
                  {drafts.length} pending draft{drafts.length === 1 ? "" : "s"}
                </Badge>
              ) : null
            }
            contentClassName="gap-4"
          >
            <div className="space-y-2">
              <label htmlFor={reviewBodyId} className="text-sm font-medium text-sachi-fg">
                Review summary
              </label>
              <Textarea
                id={reviewBodyId}
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                onKeyDown={(event) => {
                  if (!isShortcutSubmit(event) || submitReview.isPending) {
                    return;
                  }

                  event.preventDefault();
                  onSubmitReview("COMMENT");
                }}
                aria-describedby={reviewBodyHelpId}
                disabled={submitReview.isPending}
                placeholder="Summarize the overall feedback you want to send with this review."
                rows={6}
              />
              <p id={reviewBodyHelpId} className="text-sm text-sachi-fg-muted">
                Choose Comment, Approve, or Request changes below. Inline drafts with text are
                included with the selected review action. Press Cmd+Enter or Ctrl+Enter to send a
                comment review quickly.
              </p>
            </div>
            {submitReview.error ? (
              <p className="text-sm text-red-500">{submitReview.error.message}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitReview.isPending}
                onClick={() => onSubmitReview("COMMENT")}
              >
                Comment
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitReview.isPending}
                onClick={() => onSubmitReview("APPROVE")}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitReview.isPending}
                onClick={() => onSubmitReview("REQUEST_CHANGES")}
              >
                Request changes
              </Button>
            </div>
          </ReviewSurface>

          <ReviewSurface
            title="Diff"
            description="Use the gutter plus button on a changed line to start an inline draft. Drafts stay pending until you submit the review."
            action={
              <Badge variant="outline">
                {files.length} file{files.length === 1 ? "" : "s"}
              </Badge>
            }
            contentClassName="gap-4"
          >
            {files.length === 0 ? (
              <p className="text-sm text-sachi-fg-muted">No files changed in this pull request.</p>
            ) : (
              files.map((file) => (
                <DiffFile
                  key={`${file.name}:${file.newObjectId ?? file.prevObjectId ?? file.mode ?? "file"}`}
                  drafts={drafts.filter((draft) => draft.path === file.name)}
                  file={file}
                  onAddDraft={addDraft}
                  onDraftChange={updateDraft}
                  onDraftRemove={removeDraft}
                  repository={repository}
                  reviewComments={reviewComments.filter(
                    (comment) => comment.path === file.name && comment.line !== null,
                  )}
                />
              ))
            )}
          </ReviewSurface>
        </div>

        <div className="space-y-4">
          <ReviewSurface
            title="Comment"
            description="Start a general discussion thread on this pull request."
            contentClassName="gap-0"
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (commentBody.trim().length === 0 || addComment.isPending) {
                  return;
                }

                onAddComment();
              }}
            >
              <div className="space-y-2">
                <label htmlFor={commentBodyId} className="text-sm font-medium text-sachi-fg">
                  Comment body
                </label>
                <Textarea
                  id={commentBodyId}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (!isShortcutSubmit(event)) {
                      return;
                    }

                    event.preventDefault();
                    if (commentBody.trim().length === 0 || addComment.isPending) {
                      return;
                    }

                    onAddComment();
                  }}
                  aria-describedby={commentBodyHelpId}
                  disabled={addComment.isPending}
                  placeholder="Ask a question, leave context, or note follow-up work."
                  rows={5}
                />
                <p id={commentBodyHelpId} className="text-sm text-sachi-fg-muted">
                  Press Cmd+Enter or Ctrl+Enter to add it quickly.
                </p>
              </div>
              {addComment.error ? (
                <p className="text-sm text-red-500">{addComment.error.message}</p>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={commentBody.trim().length === 0 || addComment.isPending}
                >
                  Add comment
                </Button>
              </div>
            </form>
          </ReviewSurface>

          <ReviewSurface title="Discussion" contentClassName="gap-3">
            {issueComments.length === 0 ? (
              <p className="text-sm text-sachi-fg-muted">No pull request comments yet.</p>
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
  );
}

type DiffFileProps = {
  file: FileDiffMetadata;
  repository: GitHubRepository;
  reviewComments: GitHubPullRequestReviewComment[];
  drafts: DraftComment[];
  onAddDraft: (path: string, lineNumber: number, side: "LEFT" | "RIGHT") => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
};

function DiffFile({
  file,
  repository,
  reviewComments,
  drafts,
  onAddDraft,
  onDraftChange,
  onDraftRemove,
}: DiffFileProps) {
  const publishedCommentCount = reviewComments.length;
  const draftCommentCount = drafts.length;

  const annotations = React.useMemo<DiffLineAnnotation<AnnotationPayload>[]>(() => {
    const existing: DiffLineAnnotation<AnnotationPayload>[] = reviewComments.flatMap((comment) => {
      if (comment.line == null || comment.side == null) {
        return [];
      }

      return [
        {
          lineNumber: comment.line,
          metadata: {
            comment,
            kind: "existing" as const,
          },
          side: annotationSide(comment.side),
        },
      ];
    });

    const pending: DiffLineAnnotation<AnnotationPayload>[] = drafts.map((draft) => ({
      lineNumber: draft.lineNumber,
      metadata: {
        draft,
        kind: "draft" as const,
      },
      side: annotationSide(draft.side),
    }));

    return [...existing, ...pending];
  }, [drafts, reviewComments]);

  return (
    <LayerCard>
      <LayerCardSecondary className="flex-wrap items-start">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-semibold text-sachi-fg">{file.name}</h3>
          <p className="text-xs font-normal text-sachi-fg-muted">
            Add inline feedback from the gutter on either side of the diff.
          </p>
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
      </LayerCardSecondary>
      <LayerCardPrimary className="gap-0 overflow-hidden p-0">
        <FileDiff
          className="w-full"
          fileDiff={file}
          options={{
            // Use the built-in gutter utility; custom gutter renderers can
            // scroll-jump in Safari with the default line-info separators.
            diffStyle: "split",
            enableGutterUtility: true,
            onGutterUtilityClick: (range) => {
              const side = range.side === "deletions" ? "LEFT" : "RIGHT";
              onAddDraft(file.name, range.start, side);
            },
            theme: {
              dark: "github-dark",
              light: "github-light",
            },
          }}
          lineAnnotations={annotations}
          renderAnnotation={(annotation) => {
            const meta = annotation.metadata;
            if (meta.kind === "existing") {
              return (
                <LayerCard className="max-w-2xl">
                  <LayerCardSecondary className="flex-wrap items-center rounded-lg bg-sachi-surface px-3 py-2 text-xs font-normal text-sachi-fg-muted ring-1 ring-sachi-line-subtle">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium text-sachi-fg-secondary">
                        {meta.comment.user.login}
                      </span>
                      <Badge variant="outline">Published</Badge>
                      <span>{formatUpdated(meta.comment.updated_at)}</span>
                    </div>
                  </LayerCardSecondary>
                  <LayerCardPrimary className="gap-0">
                    <MarkdownContent
                      className="pull-request-markdown text-sm text-sachi-fg-secondary"
                      content={meta.comment.body}
                      emptyFallback="No comment body."
                      repository={repository}
                    />
                  </LayerCardPrimary>
                </LayerCard>
              );
            }

            const draftFieldId = `draft-${meta.draft.id}`;

            return (
              <LayerCard className="max-w-2xl">
                <LayerCardSecondary className="flex-wrap items-center rounded-lg bg-sachi-surface px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-normal text-sachi-fg-muted">
                    <span className="font-medium text-sachi-fg-secondary">Draft comment</span>
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
                </LayerCardSecondary>
                <LayerCardPrimary className="gap-2">
                  <label htmlFor={draftFieldId} className="text-sm font-medium text-sachi-fg">
                    Inline feedback
                  </label>
                  <Textarea
                    id={draftFieldId}
                    value={meta.draft.body}
                    onChange={(event) => onDraftChange(meta.draft.id, event.target.value)}
                    placeholder="Explain what should change or why this looks good."
                    rows={3}
                  />
                </LayerCardPrimary>
              </LayerCard>
            );
          }}
        />
      </LayerCardPrimary>
    </LayerCard>
  );
}

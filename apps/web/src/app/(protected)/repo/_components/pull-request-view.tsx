"use client";

import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { FileDiff } from "@pierre/diffs/react";
import type {
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubPullRequestReview,
  GitHubPullRequestReviewComment,
  GitHubRepository,
} from "@sachikit/github";
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
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Textarea } from "@sachikit/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Streamdown } from "streamdown";

import { useTRPC } from "~/lib/trpc/client";

type PullRequestViewProps = {
  repository: GitHubRepository;
  pullRequest: GitHubPullRequest;
  files: FileDiffMetadata[];
  issueComments: GitHubIssueComment[];
  reviews: GitHubPullRequestReview[];
  reviewComments: GitHubPullRequestReviewComment[];
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
      className={className}
      linkSafety={{ enabled: false }}
      mode="static"
      urlTransform={(url) => resolveMarkdownUrl(url, repository)}
    >
      {markdown}
    </Streamdown>
  );
}

export function PullRequestView({
  repository,
  pullRequest,
  files,
  issueComments,
  reviews,
  reviewComments,
}: PullRequestViewProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<DraftComment[]>([]);
  const [reviewBody, setReviewBody] = React.useState("");
  const [commentBody, setCommentBody] = React.useState("");

  const addComment = useMutation(
    trpc.github.addPullRequestComment.mutationOptions({
      onSuccess: () => {
        setCommentBody("");
        router.refresh();
      },
    })
  );

  const submitReview = useMutation(
    trpc.github.submitPullRequestReview.mutationOptions({
      onSuccess: () => {
        setDrafts([]);
        setReviewBody("");
        router.refresh();
      },
    })
  );

  function addDraft(path: string, lineNumber: number, side: "LEFT" | "RIGHT") {
    setDrafts((current) => {
      const exists = current.some(
        (draft) =>
          draft.path === path &&
          draft.lineNumber === lineNumber &&
          draft.side === side
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
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, body } : draft))
    );
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
      body: reviewBody.trim().length > 0 ? reviewBody.trim() : undefined,
      comments: comments.length > 0 ? comments : undefined,
      event,
      owner: repository.owner.login,
      pullNumber: pullRequest.number,
      repo: repository.name,
    });
  }

  function onAddComment() {
    void addComment.mutateAsync({
      body: commentBody.trim(),
      owner: repository.owner.login,
      pullNumber: pullRequest.number,
      repo: repository.name,
    });
  }

  return (
    <InsetView maxWidth="xl">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {pullRequest.title}
          </h1>
          <Badge variant="outline">#{pullRequest.number}</Badge>
          {pullRequest.draft ? <Badge variant="outline">draft</Badge> : null}
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {pullRequest.head.ref} to {pullRequest.base.ref} · updated{" "}
          {formatUpdated(pullRequest.updated_at)}
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownContent
                className="pull-request-markdown text-sm text-[var(--color-text-secondary)]"
                content={pullRequest.body}
                emptyFallback="No description provided."
                repository={repository}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Submit general feedback or include any pending inline comments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                placeholder="Add review summary"
              />
              {submitReview.error ? (
                <p className="text-sm text-red-500">
                  {submitReview.error.message}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={submitReview.isPending}
                  onClick={() => onSubmitReview("COMMENT")}
                >
                  Comment
                </Button>
                <Button
                  variant="outline"
                  disabled={submitReview.isPending}
                  onClick={() => onSubmitReview("APPROVE")}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={submitReview.isPending}
                  onClick={() => onSubmitReview("REQUEST_CHANGES")}
                >
                  Request changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diff</CardTitle>
              <CardDescription>
                Inline comments are draft-only until you submit the review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {files.map((file) => (
                <DiffFile
                  key={`${file.name}:${file.newObjectId ?? file.prevObjectId ?? file.mode ?? "file"}`}
                  drafts={drafts.filter((draft) => draft.path === file.name)}
                  file={file}
                  onAddDraft={addDraft}
                  onDraftChange={updateDraft}
                  onDraftRemove={removeDraft}
                  repository={repository}
                  reviewComments={reviewComments.filter(
                    (comment) =>
                      comment.path === file.name && comment.line !== null
                  )}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Add pull request comment"
              />
              {addComment.error ? (
                <p className="text-sm text-red-500">
                  {addComment.error.message}
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                disabled={
                  commentBody.trim().length === 0 || addComment.isPending
                }
                onClick={onAddComment}
              >
                Add comment
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discussion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {issueComments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No pull request comments yet.
                </p>
              ) : (
                issueComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-lg border border-[var(--color-border-subtle)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{comment.user.login}</span>
                      <span>{formatUpdated(comment.updated_at)}</span>
                    </div>
                    <MarkdownContent
                      className="pull-request-markdown mt-2 text-sm text-[var(--color-text-secondary)]"
                      content={comment.body}
                      repository={repository}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No reviews yet.
                </p>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg border border-[var(--color-border-subtle)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                      <span>{review.user.login}</span>
                      <Badge variant="outline">{reviewBadge(review)}</Badge>
                    </div>
                    <MarkdownContent
                      className="pull-request-markdown mt-2 text-sm text-[var(--color-text-secondary)]"
                      content={review.body}
                      emptyFallback="No summary."
                      repository={repository}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
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
  onAddDraft: (
    path: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT"
  ) => void;
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
  const annotations = React.useMemo<
    DiffLineAnnotation<AnnotationPayload>[]
  >(() => {
    const existing: DiffLineAnnotation<AnnotationPayload>[] =
      reviewComments.flatMap((comment) => {
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

    const pending: DiffLineAnnotation<AnnotationPayload>[] = drafts.map(
      (draft) => ({
        lineNumber: draft.lineNumber,
        metadata: {
          draft,
          kind: "draft" as const,
        },
        side: annotationSide(draft.side),
      })
    );

    return [...existing, ...pending];
  }, [drafts, reviewComments]);

  return (
    <div className="space-y-2">
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
              <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3 text-sm">
                <div className="text-xs text-[var(--color-text-muted)]">
                  {meta.comment.user.login}
                </div>
                <MarkdownContent
                  className="pull-request-markdown mt-2 text-[var(--color-text-secondary)]"
                  content={meta.comment.body}
                  repository={repository}
                />
              </div>
            );
          }

          return (
            <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3 text-sm">
              <Input
                value={meta.draft.body}
                onChange={(event) =>
                  onDraftChange(meta.draft.id, event.target.value)
                }
                placeholder="Draft inline comment"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDraftRemove(meta.draft.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

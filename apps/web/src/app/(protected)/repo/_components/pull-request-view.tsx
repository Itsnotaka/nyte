"use client";

import { IconChevronDownMedium } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import type { GitHubLabel } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { ButtonGroup } from "@sachikit/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sachikit/ui/components/dropdown-menu";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Textarea } from "@sachikit/ui/components/textarea";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import * as React from "react";

import { formatRelativeTime } from "~/lib/time";
import { useTRPC } from "~/lib/trpc/react";

import { ChecksPanel } from "./checks-panel";
import {
  PullRequestDiffFallback,
  PullRequestDiffSection,
  SidebarStatusFallback,
} from "./diff-section";
import { PullRequestDiscussionFallback, PullRequestDiscussionSection } from "./discussion-section";
import { EditableTitle } from "./editable-title";
import { LabelPanel } from "./label-panel";
import { SidebarSection } from "./layout-sections";
import { Section } from "./layout-sections";
import { MarkdownContent } from "./markdown-content";
import { MergeModal } from "./merge-modal";
import { ReviewerPanel } from "./reviewer-panel";
import { SidebarListFallback, PullRequestStackPanel } from "./stack-panel";
import type { DraftComment, ReviewAction } from "./types";
import { groupByPath } from "./utils";

const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  APPROVE: "Approve",
  COMMENT: "Comment",
  REQUEST_CHANGES: "Request changes",
};

type PullRequestViewProps = {
  owner: string;
  repo: string;
  pullNumber: number;
};

export function PullRequestView({ owner, repo, pullNumber }: PullRequestViewProps) {
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

  const queryInput = { owner, pullNumber, repo };

  const { data: pageData } = useSuspenseQuery(
    trpc.github.getPullRequestPage.queryOptions(queryInput, {
      staleTime: 60_000,
    }),
  );

  useHotkey("F", () => setSidebarOpen((prev) => !prev));

  const draftsByFile = React.useMemo(() => groupByPath(drafts), [drafts]);

  const pullRequestPageQueryKey = trpc.github.getPullRequestPage.queryKey(queryInput);
  const pullRequestDiscussionQueryKey = trpc.github.getPullRequestDiscussion.queryKey(queryInput);
  const pullRequestReviewCommentsQueryKey =
    trpc.github.getPullRequestReviewComments.queryKey(queryInput);

  const addComment = useMutation(
    trpc.github.addPullRequestComment.mutationOptions({
      onSuccess: async () => {
        setCommentBody("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pullRequestPageQueryKey }),
          queryClient.invalidateQueries({
            queryKey: pullRequestDiscussionQueryKey,
          }),
        ]);
      },
    }),
  );

  const submitReview = useMutation(
    trpc.github.submitPullRequestReview.mutationOptions({
      onSuccess: async () => {
        setDrafts([]);
        setReviewBody("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pullRequestPageQueryKey }),
          queryClient.invalidateQueries({
            queryKey: pullRequestDiscussionQueryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: pullRequestReviewCommentsQueryKey,
          }),
        ]);
      },
    }),
  );

  const merge = useMutation(
    trpc.github.mergePullRequest.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pullRequestPageQueryKey }),
          queryClient.invalidateQueries({
            queryKey: pullRequestDiscussionQueryKey,
          }),
        ]);
      },
    }),
  );

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

  const convertToReady = useMutation(
    trpc.github.convertToReady.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: pullRequestPageQueryKey,
        });
      },
    }),
  );

  const { repository, pullRequest } = pageData;

  const pullRequestIdentity = {
    owner: repository.owner.login,
    pullNumber: pullRequest.number,
    repo: repository.name,
  };

  const prLabels: GitHubLabel[] = (() => {
    const raw = (pullRequest as Record<string, unknown>).labels;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((label: unknown) => {
      if (typeof label !== "object" || label === null) return [];
      const l = label as {
        id?: number;
        name?: string;
        color?: string;
        description?: string | null;
      };
      if (!l.id || !l.name || !l.color) return [];
      return [
        {
          id: l.id,
          name: l.name,
          color: l.color,
          description: l.description ?? null,
        },
      ];
    });
  })();

  const isOpen = pullRequest.state === "open" && !pullRequest.merged;
  const isMerged = pullRequest.merged;

  function handleFileSelect(filename: string) {
    setActiveFile(filename);
    const element = diffAreaRef.current?.querySelector(
      `[data-file-name="${CSS.escape(filename)}"]`,
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function addDraft(path: string, lineNumber: number, side: "LEFT" | "RIGHT") {
    setDrafts((current) => {
      const exists = current.some(
        (draft) => draft.path === path && draft.lineNumber === lineNumber && draft.side === side,
      );
      if (exists) return current;
      return [...current, { body: "", id: nanoid(), lineNumber, path, side }];
    });
  }

  function updateDraft(id: string, body: string) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, body } : draft)));
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

  const reviewSubmitDisabled =
    submitReview.isPending ||
    !(reviewAction === "APPROVE" || reviewBody.trim().length > 0 || drafts.length > 0);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-sachi-line-subtle px-4">
          <div className="flex min-w-0 items-center gap-2">
            {isOpen ? (
              <EditableTitle
                title={pullRequest.title}
                onSave={(title) =>
                  updatePR.mutate({
                    ...pullRequestIdentity,
                    body: pullRequest.body ?? "",
                    title,
                  })
                }
                isPending={updatePR.isPending}
              />
            ) : (
              <h1 className="truncate text-sm font-semibold text-sachi-fg">{pullRequest.title}</h1>
            )}
            <Badge variant="outline">#{pullRequest.number}</Badge>
            {pullRequest.draft ? <Badge variant="outline">draft</Badge> : null}
            {isMerged ? (
              <Badge variant="outline">merged</Badge>
            ) : pullRequest.state === "closed" ? (
              <Badge variant="outline">closed</Badge>
            ) : null}
          </div>

          {isOpen ? (
            <div className="flex shrink-0 items-center gap-2">
              {merge.error ? (
                <p className="text-sm text-destructive">{merge.error.message}</p>
              ) : null}
              {pullRequest.draft ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={convertToReady.isPending}
                  onClick={() => convertToReady.mutate(pullRequestIdentity)}
                >
                  {convertToReady.isPending ? "Publishing..." : "Ready for review"}
                </Button>
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
                  <Button size="sm" type="button" disabled={merge.isPending}>
                    {merge.isPending ? "Merging..." : "Merge"}
                  </Button>
                }
              />
            </div>
          ) : null}
        </header>

        <div ref={diffAreaRef} className="min-w-0 flex-1 overflow-auto">
          <InsetView maxWidth="xl">
            <div className="space-y-4">
              <p className="text-sm text-sachi-fg-muted">
                {pullRequest.head.ref} → {pullRequest.base.ref} · updated{" "}
                {formatRelativeTime(pullRequest.updated_at)}
              </p>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <Section
                    title="Description"
                    action={
                      isOpen && !editingDescription ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDescriptionDraft(pullRequest.body ?? "");
                            setEditingDescription(true);
                          }}
                        >
                          Edit
                        </Button>
                      ) : null
                    }
                  >
                    {editingDescription ? (
                      <div className="space-y-2">
                        <Textarea
                          value={descriptionDraft}
                          onChange={(event) => setDescriptionDraft(event.target.value)}
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
                            onClick={() =>
                              updatePR.mutate({
                                ...pullRequestIdentity,
                                body: descriptionDraft,
                                title: pullRequest.title,
                              })
                            }
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
                  </Section>

                  {isOpen ? (
                    <Section
                      title="Review"
                      action={
                        drafts.length > 0 ? (
                          <Badge variant="outline">
                            {drafts.length} pending draft
                            {drafts.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null
                      }
                    >
                      <Textarea
                        id={reviewBodyId}
                        value={reviewBody}
                        onChange={(event) => setReviewBody(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            !((event.metaKey || event.ctrlKey) && event.key === "Enter") ||
                            reviewSubmitDisabled
                          )
                            return;
                          event.preventDefault();
                          onSubmitReview(reviewAction);
                        }}
                        disabled={submitReview.isPending}
                        placeholder="Leave a review comment..."
                        rows={3}
                      />
                      {submitReview.error ? (
                        <p className="text-sm text-destructive">{submitReview.error.message}</p>
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
                              <IconChevronDownMedium />
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
                    </Section>
                  ) : null}

                  <Section title="Comment">
                    <form
                      className="space-y-2"
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
                          if (!((event.metaKey || event.ctrlKey) && event.key === "Enter")) return;
                          event.preventDefault();
                          if (commentBody.trim().length === 0 || addComment.isPending) return;
                          onAddComment();
                        }}
                        disabled={addComment.isPending}
                        placeholder="Leave a comment..."
                        rows={3}
                      />
                      {addComment.error ? (
                        <p className="text-sm text-destructive">{addComment.error.message}</p>
                      ) : null}
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={commentBody.trim().length === 0 || addComment.isPending}
                        >
                          Comment
                        </Button>
                      </div>
                    </form>
                  </Section>

                  <React.Suspense fallback={<PullRequestDiscussionFallback />}>
                    <PullRequestDiscussionSection queryInput={queryInput} repository={repository} />
                  </React.Suspense>

                  <React.Suspense fallback={<PullRequestDiffFallback />}>
                    <PullRequestDiffSection
                      activeFile={activeFile}
                      draftsByFile={draftsByFile}
                      onAddDraft={addDraft}
                      onDraftChange={updateDraft}
                      onDraftRemove={removeDraft}
                      onFileSelect={handleFileSelect}
                      queryInput={queryInput}
                      repository={repository}
                      sidebarOpen={sidebarOpen}
                    />
                  </React.Suspense>
                </div>

                <div className="divide-y divide-sachi-line-subtle">
                  <SidebarSection title="Checks">
                    <React.Suspense fallback={<SidebarStatusFallback />}>
                      <ChecksPanel
                        owner={repository.owner.login}
                        repo={repository.name}
                        headSha={pullRequest.head.sha}
                      />
                    </React.Suspense>
                  </SidebarSection>

                  <SidebarSection title="Stack">
                    <React.Suspense fallback={<SidebarListFallback />}>
                      <PullRequestStackPanel queryInput={queryInput} />
                    </React.Suspense>
                  </SidebarSection>

                  <SidebarSection title="Reviewers">
                    <ReviewerPanel
                      owner={repository.owner.login}
                      repo={repository.name}
                      pullNumber={pullRequest.number}
                      requestedReviewers={pullRequest.requested_reviewers}
                      pullRequestPageQueryKey={pullRequestPageQueryKey}
                    />
                  </SidebarSection>

                  <SidebarSection title="Labels">
                    <LabelPanel
                      owner={repository.owner.login}
                      repo={repository.name}
                      pullNumber={pullRequest.number}
                      currentLabels={prLabels}
                      pullRequestPageQueryKey={pullRequestPageQueryKey}
                    />
                  </SidebarSection>
                </div>
              </div>
            </div>
          </InsetView>
        </div>
      </div>
    </div>
  );
}

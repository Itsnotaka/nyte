"use client";

import type { DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs/react";
import { FileDiff } from "@pierre/diffs/react";
import type { DiffSettingsJson } from "@sachikit/db/schema/settings";
import type {
  GitHubPullRequestReviewComment,
  GitHubRepository,
} from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  PanelHeader,
  PanelHeaderLeading,
  PanelHeaderTrailing,
} from "@sachikit/ui/components/panel-header";
import { Textarea } from "@sachikit/ui/components/textarea";
import * as React from "react";

import { formatRelativeTime } from "~/lib/time";

import { MarkdownContent } from "./markdown-content";
import type { AnnotationPayload, DraftComment } from "./types";

type DiffFileProps = {
  file: FileDiffMetadata;
  repository: GitHubRepository;
  reviewComments: GitHubPullRequestReviewComment[];
  drafts: DraftComment[];
  diffSettings: DiffSettingsJson;
  onAddDraft: (
    path: string,
    lineNumber: number,
    side: "LEFT" | "RIGHT"
  ) => void;
  onDraftChange: (id: string, body: string) => void;
  onDraftRemove: (id: string) => void;
};

export function DiffFile({
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
            side: comment.side === "LEFT" ? "deletions" : "additions",
          },
        ];
      });

    const pending: DiffLineAnnotation<AnnotationPayload>[] = drafts.map(
      (draft) => ({
        lineNumber: draft.lineNumber,
        metadata: { draft, kind: "draft" as const },
        side: draft.side === "LEFT" ? "deletions" : "additions",
      })
    );

    return [...existing, ...pending];
  }, [drafts, reviewComments, diffSettings.hideComments]);

  return (
    <div
      className="overflow-hidden rounded-lg ring-1 ring-sachi-line"
      data-file-name={file.name}
    >
      <PanelHeader>
        <PanelHeaderLeading>
          <h3 className="truncate text-sm font-semibold text-sachi-fg">
            {file.name}
          </h3>
        </PanelHeaderLeading>
        <PanelHeaderTrailing>
          {publishedCommentCount > 0 ? (
            <Badge variant="outline">{publishedCommentCount} published</Badge>
          ) : null}
          {draftCommentCount > 0 ? (
            <Badge variant="outline">
              {draftCommentCount} draft{draftCommentCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </PanelHeaderTrailing>
      </PanelHeader>
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
                  <span>{formatRelativeTime(meta.comment.updated_at)}</span>
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

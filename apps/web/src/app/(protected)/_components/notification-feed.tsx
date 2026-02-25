"use client";

import { Button } from "@nyte/ui/components/button";
import { ScrollArea } from "@nyte/ui/components/scroll-area";
import { Spinner } from "@nyte/ui/components/spinner";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "~/lib/convex";

import { FeedSkeleton } from "./feed-skeleton";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function formatUpdatedAt(updatedAt: number): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "Updated just now";
  }

  return date.toLocaleString();
}

export function NotificationFeed() {
  const reviewRuns = useQuery(api.commandCenter.reviewReplyList, { limit: 24 });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const detail = useQuery(
    api.commandCenter.reviewReplyDetail,
    selectedRunId ? { runId: selectedRunId } : "skip"
  );

  const respondAgent = useAction(api.agent.respond);
  const confirmAgent = useMutation(api.agent.confirm);

  const [draftMessage, setDraftMessage] = useState("");
  const [isSendPending, setIsSendPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      setDraftMessage(detail.inputText);
    }
  }, [detail]);

  useEffect(() => {
    if (!reviewRuns || !selectedRunId) {
      return;
    }

    if (!reviewRuns.some((run) => run.runId === selectedRunId)) {
      setSelectedRunId(null);
    }
  }, [reviewRuns, selectedRunId]);

  if (reviewRuns === undefined) {
    return <FeedSkeleton />;
  }

  const selectedListItem =
    selectedRunId !== null
      ? reviewRuns.find((run) => run.runId === selectedRunId) ?? null
      : null;

  async function sendEditedReply() {
    if (!selectedRunId || isSendPending) {
      return;
    }

    const trimmedMessage = draftMessage.trim();
    if (trimmedMessage.length === 0) {
      setActionError("Enter an updated draft before sending.");
      return;
    }

    setActionError(null);
    setActionInfo(null);
    setIsSendPending(true);

    try {
      const respondResult = await respondAgent({
        runId: selectedRunId,
        message: trimmedMessage,
      });

      if (respondResult.status === "awaiting_follow_up") {
        setSelectedRunId(null);
        setActionInfo(
          "More details are needed. Continue in the command composer below."
        );
        return;
      }

      if (respondResult.status !== "awaiting_approval") {
        throw new Error("Run is not ready for confirmation.");
      }

      await confirmAgent({ runId: selectedRunId });
      setSelectedRunId(null);
      setActionInfo("Reply confirmed.");
    } catch (error) {
      setActionError(toErrorMessage(error, "Unable to send this reply."));
    } finally {
      setIsSendPending(false);
    }
  }

  return (
    <section className="min-h-0 flex flex-1 flex-col gap-3">
      {actionError ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <div className="flex items-center justify-between gap-3">
            <p>{actionError}</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setActionError(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {actionInfo ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          {actionInfo}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="min-h-0 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3 lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-text-faint)]">
              {reviewRuns.length} awaiting approval
            </p>
          </div>

          {reviewRuns.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No runs are waiting for review.
              </p>
            </div>
          ) : (
            <ScrollArea className="mt-3 min-h-0 lg:flex-1 pr-1">
              <ul className="flex flex-col gap-3 pb-2">
                {reviewRuns.map((run) => {
                  const isSelected = run.runId === selectedRunId;
                  return (
                    <li key={run.runId}>
                      <article
                        className={`rounded-lg border bg-[var(--color-inset-bg)] p-3 ${
                          isSelected
                            ? "border-[var(--color-focus)]"
                            : "border-[var(--color-border-subtle)]"
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] text-[var(--color-text-faint)]">
                            {run.source} · {run.type}
                          </p>
                          <h3 className="text-sm text-[var(--color-text-primary)]">
                            {run.summary}
                          </h3>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {run.preview}
                          </p>
                          <p className="text-xs text-[var(--color-text-faint)]">
                            Risk: {run.riskLevel}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] text-[var(--color-text-faint)]">
                            {formatUpdatedAt(run.updatedAt)}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => {
                              setSelectedRunId(run.runId);
                              setActionError(null);
                              setActionInfo(null);
                            }}
                          >
                            Review Reply
                          </Button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3">
          {!selectedRunId ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a run and choose Review Reply.
              </p>
            </div>
          ) : detail === undefined ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Spinner className="size-4" />
              Loading run detail...
            </div>
          ) : detail === null ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] px-4 py-6">
              <p className="text-sm text-[var(--color-text-secondary)]">
                This run is no longer awaiting approval.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedRunId(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] text-[var(--color-text-faint)]">
                  {detail.source} · {detail.type} · {detail.payloadKind}
                </p>
                <h3 className="text-sm text-[var(--color-text-primary)]">
                  {detail.summary}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {detail.preview}
                </p>
                <p className="text-xs text-[var(--color-text-faint)]">
                  {formatUpdatedAt(detail.updatedAt)}
                </p>
              </div>

              <label
                htmlFor="review-reply-editor"
                className="text-xs text-[var(--color-text-faint)]"
              >
                Edit message before send
              </label>
              <textarea
                id="review-reply-editor"
                value={draftMessage}
                onChange={(event) => {
                  setDraftMessage(event.target.value);
                }}
                className="min-h-40 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-strong)]"
              />

              <p className="text-xs text-[var(--color-text-faint)]">
                Send path: respond, then confirm.
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSendPending}
                  onClick={() => {
                    setSelectedRunId(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSendPending || draftMessage.trim().length === 0}
                  onClick={() => {
                    void sendEditedReply();
                  }}
                >
                  {isSendPending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner className="size-3.5" />
                      Sending
                    </span>
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>
            </div>
          )}

          {selectedListItem && detail === undefined ? (
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">
              {selectedListItem.summary}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

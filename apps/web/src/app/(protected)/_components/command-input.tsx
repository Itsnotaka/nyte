"use client";

import { Button } from "@nyte/ui/components/button";
import { Kbd } from "@nyte/ui/components/kbd";
import { Spinner } from "@nyte/ui/components/spinner";
import { useFilteredList } from "@nyte/ui/hooks/use-filtered-list";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";

import { api } from "~/lib/convex";

import {
  createContactPill,
  getCursorPosition,
  parseFromDOM,
  replaceCurrentTokenWithNode,
  setCursorPosition,
  type PromptPart,
} from "./command-input/editor-dom";
import {
  SlashPopover,
  type CommandSuggestionItem,
} from "./command-input/slash-popover";

type CommandRunState = {
  runId: string;
  status: "awaiting_follow_up" | "awaiting_approval";
  followUpQuestion?: string;
  proposal: {
    summary: string;
    preview: string;
    riskLevel: "low" | "medium" | "high";
    suggestionText: string;
    suggestedContactEmail?: string;
    cta: "Send email" | "Create event" | "Queue refund";
    payload: {
      kind:
        | "gmail.createDraft"
        | "google-calendar.createEvent"
        | "billing.queueRefund";
    };
  };
  retrievalHits: Array<{
    sourceType: string;
    sourceId: string;
    summary: string;
    score: number;
    whyRelevant: string;
  }>;
};

const EMPTY_CONTACTS: Array<{
  contactId: string;
  email: string;
  display: string;
}> = [];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return "Unable to process this command right now.";
}

function isLikelyEmail(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalized);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function displayFromEmail(email: string): string {
  const localPart = email.split("@")[0];
  return localPart && localPart.length > 0 ? localPart : email;
}

export function CommandInput() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [parts, setParts] = useState<PromptPart[]>([]);
  const [mode, setMode] = useState<{
    type: "mention" | null;
    query: string;
    tokenLength: number;
  }>({
    type: null,
    query: "",
    tokenLength: 0,
  });
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [isComposing, setIsComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTurnPending, setIsTurnPending] = useState(false);
  const [isConfirmPending, setIsConfirmPending] = useState(false);
  const [isAddContactPending, setIsAddContactPending] = useState(false);
  const [runState, setRunState] = useState<CommandRunState | null>(null);

  const previewAgent = useAction(api.agent.preview);
  const respondAgent = useAction(api.agent.respond);
  const confirmAgent = useMutation(api.agent.confirm);
  const addContactFromEmail = useMutation(api.contacts.addFromEmail);
  const contactsQuery = useQuery(
    api.contacts.search,
    mode.type === "mention"
      ? {
          query: mode.query,
          limit: 8,
        }
      : "skip"
  );
  const contacts = contactsQuery ?? EMPTY_CONTACTS;

  const sourceItems: CommandSuggestionItem[] = contacts.map((contact) => ({
    id: `contact-${contact.contactId}`,
    type: "contact" as const,
    group: "Contacts" as const,
    label: `@${contact.display}`,
    description: contact.email,
    contactId: contact.contactId,
    email: contact.email,
    display: contact.display,
  }));

  const filtered = useFilteredList({
    items: sourceItems,
    query: mode.query,
    maxItems: 10,
    getLabel: (item) => item.label,
    getKeywords: (item) =>
      item.type === "contact" ? [item.email] : [item.description],
    getGroup: (item) => item.group,
  });

  const canSubmit = message.trim().length > 0 && !isTurnPending;
  const canConfirm =
    runState?.status === "awaiting_approval" && !isConfirmPending;

  const mentionEmailCandidate =
    mode.type === "mention" && isLikelyEmail(mode.query)
      ? normalizeEmail(mode.query)
      : null;

  const popoverEmptyState =
    mode.type === "mention"
      ? mentionEmailCandidate
        ? {
            title: "No matching contact.",
            description: "Add this email as a contact to mention it next time.",
            actionLabel: `Add ${mentionEmailCandidate} to contacts`,
            onAction: () => {
              void addEmailContact(mentionEmailCandidate);
            },
          }
        : {
            title: "No contacts found.",
            description:
              "Type a full email after @ to add a new contact, or continue with plain text.",
          }
      : undefined;

  function syncFromEditor() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const parsed = parseFromDOM(editor);
    const text = parsed.text.replace(/\s+/g, " ").trim();
    setMessage(text);
    setParts(parsed.parts);

    const cursor = getCursorPosition(editor);
    const beforeCursor = parsed.text.slice(0, cursor);
    const mentionMatch = beforeCursor.match(
      /(^|[\s([{'"`])@([a-z0-9._%+\-@]*)$/i
    );
    if (mentionMatch) {
      const query = mentionMatch[2] ?? "";
      setMode({
        type: "mention",
        query,
        tokenLength: query.length + 1,
      });
    } else {
      setMode({ type: null, query: "", tokenLength: 0 });
    }

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    const fallbackRect = editor.getBoundingClientRect();
    setPopoverPosition({
      x: (rect?.left ?? fallbackRect.left) + 8,
      y: (rect?.bottom ?? fallbackRect.bottom) + 8,
    });
  }

  function clearComposer() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.replaceChildren();
    setMessage("");
    setParts([]);
    setMode({ type: null, query: "", tokenLength: 0 });
  }

  async function addEmailContact(email: string) {
    setError(null);
    setIsAddContactPending(true);
    try {
      const normalized = normalizeEmail(email);
      await addContactFromEmail({
        email: normalized,
        display: displayFromEmail(normalized),
      });
      setRunState((currentState) => {
        if (!currentState) {
          return null;
        }
        return {
          ...currentState,
          proposal: {
            ...currentState.proposal,
            suggestedContactEmail:
              currentState.proposal.suggestedContactEmail === normalized
                ? undefined
                : currentState.proposal.suggestedContactEmail,
          },
        };
      });
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    } finally {
      setIsAddContactPending(false);
    }
  }

  function insertSuggestion(item: CommandSuggestionItem) {
    const editor = editorRef.current;
    if (!editor || item.type !== "contact") {
      return;
    }

    replaceCurrentTokenWithNode({
      root: editor,
      tokenLength: mode.tokenLength,
      node: createContactPill({
        contactId: item.contactId,
        email: item.email,
        display: item.display,
      }),
    });

    syncFromEditor();
    setMode({ type: null, query: "", tokenLength: 0 });
  }

  async function submitTurn() {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setIsTurnPending(true);
    try {
      const trimmedMessage = message.trim();
      const response =
        runState?.status === "awaiting_follow_up"
          ? await respondAgent({
              runId: runState.runId,
              message: trimmedMessage,
              parts,
            })
          : await previewAgent({
              message: trimmedMessage,
              parts,
              triggerType: "manual",
            });
      setRunState(response as CommandRunState);
      clearComposer();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    } finally {
      setIsTurnPending(false);
    }
  }

  async function confirmRun() {
    if (!runState?.runId || !canConfirm) {
      return;
    }
    setError(null);
    setIsConfirmPending(true);
    try {
      await confirmAgent({ runId: runState.runId });
      setRunState(null);
      clearComposer();
    } catch (mutationError) {
      setError(toErrorMessage(mutationError));
    } finally {
      setIsConfirmPending(false);
    }
  }

  function applyPrefillSuggestion() {
    const suggestion = runState?.proposal.suggestionText?.trim();
    const editor = editorRef.current;
    if (!editor || !suggestion) {
      return;
    }
    editor.replaceChildren(document.createTextNode(suggestion));
    setCursorPosition(editor, suggestion.length);
    setRunState(null);
    syncFromEditor();
  }

  return (
    <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3">
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          await submitTurn();
        }}
      >
        <label htmlFor="agent-command" className="sr-only">
          Command
        </label>
        <div className="relative">
          <div
            ref={editorRef}
            id="agent-command"
            role="textbox"
            aria-label="Command"
            contentEditable
            suppressContentEditableWarning
            className="min-h-10 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-sm outline-none focus:border-[var(--color-border-default)]"
            onInput={() => {
              syncFromEditor();
              if (runState?.status === "awaiting_approval") {
                setRunState(null);
              }
            }}
            onBlur={() => {
              setMode({ type: null, query: "", tokenLength: 0 });
            }}
            onClick={syncFromEditor}
            onKeyUp={syncFromEditor}
            onCompositionStart={() => {
              setIsComposing(true);
            }}
            onCompositionEnd={() => {
              setIsComposing(false);
              syncFromEditor();
            }}
            onKeyDown={(event) => {
              if (mode.type && event.key === "Escape") {
                event.preventDefault();
                setMode({ type: null, query: "", tokenLength: 0 });
                return;
              }
              if (mode.type && filtered.filtered.length > 0) {
                if (
                  event.key === "ArrowDown" ||
                  (event.ctrlKey && event.key === "n")
                ) {
                  event.preventDefault();
                  filtered.moveActiveIndex(1);
                  return;
                }
                if (
                  event.key === "ArrowUp" ||
                  (event.ctrlKey && event.key === "p")
                ) {
                  event.preventDefault();
                  filtered.moveActiveIndex(-1);
                  return;
                }
                if (event.key === "Enter" && !isComposing) {
                  event.preventDefault();
                  if (filtered.activeItem) {
                    insertSuggestion(filtered.activeItem);
                  }
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey && !isComposing) {
                event.preventDefault();
                void submitTurn();
              }
            }}
            data-placeholder="Ask in plain language. Nyte asks follow-ups if needed."
          />
          {message.trim().length === 0 ? (
            <p className="pointer-events-none absolute top-2.5 left-3 text-sm text-[var(--color-text-tertiary)]">
              Ask in plain language. Nyte asks follow-ups if needed.
            </p>
          ) : null}
          <SlashPopover
            open={mode.type === "mention"}
            x={popoverPosition.x}
            y={popoverPosition.y}
            items={filtered.filtered}
            activeIndex={filtered.activeIndex}
            onHoverIndex={(index) => {
              filtered.setActiveIndex(index);
            }}
            onSelect={(item) => {
              insertSuggestion(item);
            }}
            emptyState={
              filtered.filtered.length === 0 ? popoverEmptyState : undefined
            }
          />
        </div>

        {runState ? (
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)] p-2.5">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {runState.status === "awaiting_follow_up"
                ? "Follow-up"
                : "Ready for approval"}
            </p>
            {runState.status === "awaiting_follow_up" &&
            runState.followUpQuestion ? (
              <p className="text-sm text-[var(--color-text-primary)]">
                {runState.followUpQuestion}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {runState.proposal.summary}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {runState.proposal.preview}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              Risk: {runState.proposal.riskLevel}
            </p>
            {runState.proposal.suggestedContactEmail ? (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isAddContactPending}
                  onClick={() => {
                    if (runState.proposal.suggestedContactEmail) {
                      void addEmailContact(
                        runState.proposal.suggestedContactEmail
                      );
                    }
                  }}
                >
                  {isAddContactPending
                    ? "Adding contact..."
                    : `Add ${runState.proposal.suggestedContactEmail} to contacts`}
                </Button>
              </div>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              {runState.status === "awaiting_approval" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canConfirm}
                  onClick={() => {
                    void confirmRun();
                  }}
                >
                  {isConfirmPending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner className="size-3.5" />
                      Approving
                    </span>
                  ) : (
                    runState.proposal.cta
                  )}
                </Button>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Reply in the input above to continue.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRunState(null);
                }}
              >
                Clear
              </Button>
            </div>
            {runState.retrievalHits.length > 0 ? (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Related context
                </p>
                {runState.retrievalHits.slice(0, 5).map((hit) => (
                  <p
                    key={`${hit.sourceType}:${hit.sourceId}`}
                    className="text-xs text-[var(--color-text-secondary)]"
                  >
                    [{hit.sourceType}] {hit.summary}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {runState?.proposal.suggestionText ? (
          <div className="rounded-md border border-dashed border-[var(--color-border-subtle)] px-2 py-1.5">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {runState.proposal.suggestionText}
            </p>
            <div className="mt-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={applyPrefillSuggestion}
              >
                Apply suggestion
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            @mentions are optional helper pills; all text is processed as-is.
          </p>
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {isTurnPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3.5" />
                Working
              </span>
            ) : runState?.status === "awaiting_follow_up" ? (
              "Reply"
            ) : (
              "Preview"
            )}
          </Button>
        </div>
        <div className="flex justify-end">
          <Kbd>Enter</Kbd>
        </div>
      </form>

      {error ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { Button } from "@nyte/ui/components/button";
import { Input } from "@nyte/ui/components/input";
import { Kbd } from "@nyte/ui/components/kbd";
import { Spinner } from "@nyte/ui/components/spinner";
import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "~/lib/convex";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return "Unable to queue this command right now.";
}

export function CommandInput() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const runAgent = useMutation(api.agent.run);

  const canSubmit = message.trim().length > 0 && !isPending;

  return (
    <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            return;
          }

          setError(null);
          setIsPending(true);
          void runAgent({ message: message.trim() })
            .then(() => {
              setMessage("");
            })
            .catch((mutationError) => {
              setError(toErrorMessage(mutationError));
            })
            .finally(() => {
              setIsPending(false);
            });
        }}
      >
        <label htmlFor="agent-command" className="sr-only">
          Command
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="agent-command"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
            }}
            placeholder="Ask the agent to draft, schedule, or queue a refund..."
            autoComplete="off"
          />
          <Button type="submit" disabled={!canSubmit}>
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3.5" />
                Running
              </span>
            ) : (
              "Go"
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Every command is queued for approval before execution.
          </p>
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

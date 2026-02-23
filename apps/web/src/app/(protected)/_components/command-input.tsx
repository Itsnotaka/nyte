"use client";

import { Button } from "@nyte/ui/components/button";
import { Input } from "@nyte/ui/components/input";
import { Kbd } from "@nyte/ui/components/kbd";
import { Spinner } from "@nyte/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/lib/trpc";

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queueFeedQueryKey = trpc.queue.feed.queryKey(undefined);

  const agentRun = useMutation(
    trpc.agent.run.mutationOptions({
      onSuccess: () => {
        setMessage("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: queueFeedQueryKey });
      },
      onError: (mutationError) => {
        setError(toErrorMessage(mutationError));
      },
    })
  );

  const canSubmit = message.trim().length > 0 && !agentRun.isPending;

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
          agentRun.mutate({ message: message.trim() });
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
            {agentRun.isPending ? (
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

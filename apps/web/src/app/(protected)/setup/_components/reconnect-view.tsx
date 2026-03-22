"use client";

import { IconGithubDefault } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { Button } from "@sachikit/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "~/lib/auth/client";

export function ReconnectView() {
  const conn = useMutation({
    mutationFn: async () => {
      const result = await authClient.linkSocial({
        provider: "github",
        callbackURL: "/setup",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to reconnect GitHub.");
      }
      return result.data;
    },
  });

  return (
    <section className="flex h-full items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-sachi-fg">Reconnect GitHub</h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            Your Sachi session is active, but your GitHub token expired or is invalid. Reconnect
            your GitHub account to continue.
          </p>
        </div>

        <Button size="lg" disabled={conn.isPending} onClick={() => conn.mutate()}>
          <IconGithubDefault className="size-4" />
          {conn.isPending ? "Opening GitHub..." : "Reconnect GitHub"}
        </Button>

        {conn.error ? <p className="text-sm text-destructive">{conn.error.message}</p> : null}
      </div>
    </section>
  );
}

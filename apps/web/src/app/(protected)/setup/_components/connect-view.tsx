"use client";

import { Button } from "@nyte/ui/components/button";
import * as React from "react";

import { trpc } from "~/lib/trpc/client";

export function ConnectView() {
  const [didOpenGithub, setDidOpenGithub] = React.useState(false);
  const startInstallMutation = trpc.github.startInstall.useMutation();

  async function handleInstall() {
    const installWindow = window.open("", "_blank", "noopener,noreferrer");

    try {
      const { url } = await startInstallMutation.mutateAsync();
      setDidOpenGithub(true);

      if (installWindow) {
        installWindow.location.href = url;
        installWindow.focus();
        return;
      }

      window.location.href = url;
    } catch {
      installWindow?.close();
    }
  }

  return (
    <section className="flex h-full items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Connect GitHub
          </h1>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            Install the Nyte GitHub App on your account to get started. This
            gives Nyte read access to your repositories.
          </p>
        </div>

        <Button
          size="lg"
          disabled={startInstallMutation.isPending}
          onClick={() => void handleInstall()}
        >
          {startInstallMutation.isPending
            ? "Opening GitHub..."
            : didOpenGithub
              ? "Open GitHub again"
              : "Install the Nyte App on GitHub"}
        </Button>

        {startInstallMutation.error ? (
          <p className="text-sm text-red-500">
            {startInstallMutation.error.message ??
              "Unable to start the GitHub app install."}
          </p>
        ) : null}

        <p className="text-xs text-[var(--color-text-faint)]">
          {didOpenGithub
            ? "GitHub opened in a new tab. Finish installation there and we’ll bring you back automatically."
            : "We’ll open GitHub in a new tab so you can finish installation without losing your place."}
        </p>
      </div>
    </section>
  );
}

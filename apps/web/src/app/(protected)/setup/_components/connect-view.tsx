"use client";

import { Button } from "@sachikit/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/react";

export function ConnectView() {
  const trpc = useTRPC();
  const installWindowRef = React.useRef<Window | null>(null);
  const startInstallMutation = useMutation(
    trpc.github.startInstall.mutationOptions({
      onError: () => {
        installWindowRef.current?.close();
        installWindowRef.current = null;
      },
      onSuccess: ({ url }) => {
        const installWindow = installWindowRef.current;
        installWindowRef.current = null;

        if (installWindow && !installWindow.closed) {
          installWindow.location.assign(url);
          installWindow.focus();
          return;
        }

        window.location.assign(url);
      },
    }),
  );

  function handleInstall() {
    const installWindow = window.open("about:blank", "_blank");
    if (installWindow) {
      installWindow.opener = null;
    }
    installWindowRef.current = installWindow;
    startInstallMutation.mutate();
  }

  return (
    <section className="flex h-full items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-sachi-fg">Install the GitHub App</h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            You&apos;re signed in to Sachi. Next, install the Sachi GitHub App on the GitHub account
            or organization you want to use.
          </p>
        </div>

        <Button size="lg" disabled={startInstallMutation.isPending} onClick={handleInstall}>
          {startInstallMutation.isPending ? "Opening GitHub..." : "Continue to GitHub App install"}
        </Button>

        {startInstallMutation.error ? (
          <p className="text-sm text-destructive">
            {startInstallMutation.error.message ?? "Unable to start the GitHub app install."}
          </p>
        ) : null}

        <p className="text-xs text-sachi-fg-faint">
          We&apos;ll open GitHub in a new tab so you can finish the GitHub App installation without
          losing your place in Sachi.
        </p>
      </div>
    </section>
  );
}

"use client";

import { Button } from "@sachikit/ui/components/button";
import * as React from "react";

export function ConnectView({ url }: { url: string }) {
  const ref = React.useRef<Window | null>(null);
  const [busy, setBusy] = React.useState(false);

  function open() {
    const tab = window.open("about:blank", "_blank");
    if (tab) {
      tab.opener = null;
    }
    ref.current = tab;
    setBusy(true);

    const next = ref.current;
    ref.current = null;
    if (next && !next.closed) {
      next.location.assign(url);
      next.focus();
      setBusy(false);
      return;
    }

    window.location.assign(url);
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

        <Button size="lg" disabled={busy} onClick={open}>
          {busy ? "Opening GitHub..." : "Continue to GitHub App install"}
        </Button>

        <p className="text-xs text-sachi-fg-faint">
          We&apos;ll open GitHub in a new tab so you can finish the GitHub App installation without
          losing your place in Sachi.
        </p>
      </div>
    </section>
  );
}

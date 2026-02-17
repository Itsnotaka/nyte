"use client";

import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

export function HomeLanding() {
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);

  const connectGoogle = React.useCallback(async () => {
    setConnectError(null);
    setIsConnecting(true);

    try {
      await authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      });
    } catch {
      setConnectError("Unable to connect Google right now. Please try again.");
      setIsConnecting(false);
    }
  }, []);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_12%,#6aa5ff_0%,transparent_30%),radial-gradient(circle_at_88%_16%,#f18bd1_0%,transparent_36%),radial-gradient(circle_at_86%_86%,#ff8359_0%,transparent_38%),radial-gradient(circle_at_16%_82%,#45c8ff_0%,transparent_36%),linear-gradient(125deg,#4f46e5_0%,#0ea5e9_40%,#f97316_100%)] px-4 py-10 md:py-14">
      <section className="mx-auto max-w-[760px] rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl md:p-8">
        <p className="text-xs font-medium tracking-[0.24em] text-zinc-500 uppercase">Nyte</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-900 md:text-4xl">
          Focus on decisions, not inbox triage.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 md:text-base">
          Connect Google once. Nyte surfaces the messages and events that need your approval,
          keeps proposed actions editable, and runs execution through a typed workflow boundary.
        </p>

        <div className="mt-5 grid gap-2 text-sm text-zinc-700">
          <p>• Login with Google (Gmail + Calendar scopes).</p>
          <p>• Review action cards with clear approve/dismiss controls.</p>
          <p>• Keep all workflow runs observable via structured logs.</p>
        </div>

        <div className="mt-7 flex flex-col items-start gap-3">
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-65"
            onClick={() => void connectGoogle()}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting Google…" : "Continue with Google"}
          </button>

          {connectError ? (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {connectError}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

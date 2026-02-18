"use client";

import { Instrument_Serif } from "next/font/google";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

export function Landing() {
  const {
    mutate: connect,
    isPending,
    error,
  } = useMutation({
    mutationFn: () =>
      authClient.signIn.social({ provider: GOOGLE_AUTH_PROVIDER, callbackURL: "/" }),
  });

  return (
    <main
      className={`${instrumentSerif.variable} relative min-h-dvh overflow-hidden bg-[#050505]`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(163,230,53,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-15%] bottom-[-10%] h-[800px] w-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(163,230,53,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col px-6 py-16 md:px-12 lg:px-20">
        <header className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.3em] text-[#333] uppercase">
            Nyte
          </span>
          <span className="h-px flex-1 max-w-[40px] bg-[#1a1a1a]" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#1e1e1e]">
            v0.1
          </span>
        </header>

        <div className="mt-auto mb-auto flex flex-col gap-8 max-w-3xl pt-24 pb-16">
          <div className="space-y-1">
            <p className="font-mono text-[11px] tracking-[0.25em] text-[#a3e635] uppercase">
              Inbox intelligence
            </p>
          </div>

          <h1
            className="font-display text-[clamp(2.8rem,8vw,6rem)] leading-[0.95] tracking-tight text-[#f0f0f0]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Focus on decisions,{" "}
            <em className="text-[#a3e635] not-italic">not</em>
            <br />
            inbox triage.
          </h1>

          <p className="max-w-[480px] text-base leading-relaxed text-[#525252]">
            Connect Google once. Nyte surfaces the messages and calendar events
            that need your approval — nothing else.
          </p>

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => connect()}
                disabled={isPending}
                className="group relative inline-flex h-11 items-center gap-3 rounded-none border border-[#a3e635] bg-transparent px-6 font-mono text-sm tracking-wider text-[#a3e635] transition-all duration-150 hover:bg-[#a3e635] hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="relative z-10">
                  {isPending ? "Connecting…" : "Continue with Google"}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[#a3e635] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                />
              </button>

              <div className="flex items-center gap-2">
                {(["Gmail", "Calendar"] as const).map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-none border border-[#1a1a1a] px-2.5 py-1 font-mono text-[10px] tracking-wider text-[#333] uppercase"
                  >
                    <span className="size-1.5 rounded-full bg-[#1e1e1e]" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {error ? (
              <p className="font-mono text-xs text-red-500">
                ↳ {error.message}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="mt-auto flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[#a3e635] shadow-[0_0_6px_rgba(163,230,53,0.8)]" />
            <span className="font-mono text-[10px] tracking-wider text-[#333]">
              System online
            </span>
          </div>
          <div className="flex gap-4">
            {(["Review reply", "Accept invite", "Queue refund"] as const).map((label) => (
              <span key={label} className="font-mono text-[10px] text-[#222]">
                {label}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}

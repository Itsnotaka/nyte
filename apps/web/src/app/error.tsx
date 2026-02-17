"use client";

type HomeErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: HomeErrorProps) {
  const message =
    error.message.trim().length > 0 ? error.message : "Unable to load Nyte home right now.";

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_12%,#6aa5ff_0%,transparent_30%),radial-gradient(circle_at_88%_16%,#f18bd1_0%,transparent_36%),radial-gradient(circle_at_86%_86%,#ff8359_0%,transparent_38%),radial-gradient(circle_at_16%_82%,#45c8ff_0%,transparent_36%),linear-gradient(125deg,#4f46e5_0%,#0ea5e9_40%,#f97316_100%)] px-4 py-10 md:py-14">
      <section className="mx-auto max-w-[760px] rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl md:p-8">
        <p className="text-xs font-medium tracking-[0.24em] text-zinc-500 uppercase">Nyte</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Something went wrong.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">{message}</p>
        <button
          type="button"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          onClick={reset}
        >
          Try again
        </button>
      </section>
    </main>
  );
}

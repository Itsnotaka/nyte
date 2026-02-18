"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  void error;
  const message = "Unable to load Nyte right now.";

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center bg-[#050505] px-8 py-16">
      <p className="font-mono text-[10px] tracking-[0.3em] text-[#333] uppercase">
        Nyte / Error
      </p>
      <h1 className="mt-6 font-mono text-2xl font-medium text-[#f0f0f0]">
        Something went wrong.
      </h1>
      <p className="mt-3 font-mono text-sm text-[#525252]">{message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 h-9 inline-flex items-center border border-[#1a1a1a] px-4 font-mono text-xs text-[#a3a3a3] transition-colors hover:border-[#252525] hover:text-[#f0f0f0]"
      >
        Retry
      </button>
    </main>
  );
}

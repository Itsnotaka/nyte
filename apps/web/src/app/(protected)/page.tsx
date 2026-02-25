import { Suspense } from "react";

import { CommandCenter } from "./_components/command-center";
import { CommandInput } from "./_components/command-input";
import { FeedSkeleton } from "./_components/feed-skeleton";

export default function App() {
  return (
    <section className="h-full min-h-0 bg-[var(--color-inset-bg)]">
      <div className="mx-auto flex h-full w-full max-w-[780px] flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl text-[var(--color-text-primary)]">What&apos;s new?</h1>
        </header>

        <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] px-4 py-3">
          <h2 className="text-sm text-[var(--color-text-primary)]">Summary</h2>
        </section>

        <Suspense fallback={<FeedSkeleton />}>
          <CommandCenter />
        </Suspense>

        <CommandInput />
      </div>
    </section>
  );
}

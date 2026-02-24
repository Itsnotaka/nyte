import { Suspense } from "react";

import { CommandCenter } from "./_components/command-center";
import { CommandInput } from "./_components/command-input";
import { FeedProvider } from "./_components/feed-provider";
import { FeedSkeleton } from "./_components/feed-skeleton";

export default function App() {
  return (
    <section className="h-full min-h-0 bg-[var(--color-inset-bg)]">
      <div className="mx-auto flex h-full w-full max-w-[672px] flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
        <CommandInput />
        <Suspense fallback={<FeedSkeleton />}>
          <FeedProvider>
            <CommandCenter />
          </FeedProvider>
        </Suspense>
      </div>
    </section>
  );
}

"use client";

import { Button } from "@sachikit/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@sachikit/ui/components/empty";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            {error.message || "An unexpected error occurred while loading this page."}
          </EmptyDescription>
          {error.digest ? (
            <p className="text-xs text-sachi-fg-faint">Error ID: {error.digest}</p>
          ) : null}
        </EmptyHeader>
        <Button onClick={reset}>Try again</Button>
      </Empty>
    </div>
  );
}

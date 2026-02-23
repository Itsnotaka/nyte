import { Skeleton } from "@nyte/ui/components/skeleton";

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={`feed-skeleton-${index}`}
          className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-4"
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-end gap-2 pt-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

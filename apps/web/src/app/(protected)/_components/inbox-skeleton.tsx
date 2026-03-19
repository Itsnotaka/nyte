import { IconChevronDownMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { DEFAULT_INBOX_SECTION_RULES, type InboxSectionId } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Card } from "@sachikit/ui/components/card";
import { Skeleton } from "@sachikit/ui/components/skeleton";

const MAX_SKELETON_ROWS = 8;

export type InboxSkeletonSection = {
  id: InboxSectionId;
  label: string;
  count: number;
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-sachi-line-subtle/50 px-4 py-2.5 last:border-b-0">
      <Skeleton className="size-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-3 w-10 shrink-0" />
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  );
}

/**
 * Loading placeholder for the inbox. When `sections` is provided (from
 * `getInboxSectionMeta`), only sections with count &gt; 0 expand and show row
 * skeletons; counts match the metadata query rather than hardcoded guesses.
 */
export function InboxSkeleton({
  sections: sectionsFromMeta,
}: {
  sections?: readonly InboxSkeletonSection[] | null;
}) {
  const hasLiveMeta = sectionsFromMeta != null;
  const rows: InboxSkeletonSection[] = hasLiveMeta
    ? [...sectionsFromMeta]
    : DEFAULT_INBOX_SECTION_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        count: 0,
      }));

  return (
    <div className="h-full min-h-0 overflow-hidden bg-sachi-base">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        {rows.map((row) => {
          const isExpanded = hasLiveMeta && row.count > 0;
          const rowCount = isExpanded ? Math.min(row.count, MAX_SKELETON_ROWS) : 0;

          return (
            <Card key={row.id}>
              <div className="flex items-center border-b border-sachi-line-subtle/50 px-4 py-2.5">
                <div className="flex flex-1 items-center gap-2 text-sm">
                  <IconChevronDownMedium
                    className={`size-4 shrink-0 text-sachi-fg-faint ${isExpanded ? "" : "-rotate-90"}`}
                    aria-hidden="true"
                  />
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
                  >
                    {hasLiveMeta ? row.count : <Skeleton className="h-3 w-2" />}
                  </Badge>
                  <span className="font-medium text-sachi-fg">{row.label}</span>
                </div>
              </div>

              {rowCount > 0 && (
                <div>
                  {Array.from({ length: rowCount }, (_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

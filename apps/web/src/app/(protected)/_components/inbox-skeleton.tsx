import { IconChevronDownMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { DEFAULT_INBOX_SECTION_RULES } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Card } from "@sachikit/ui/components/card";
import { Skeleton } from "@sachikit/ui/components/skeleton";

export function InboxSkeleton() {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-sachi-base">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        {DEFAULT_INBOX_SECTION_RULES.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-center border-b border-sachi-line-subtle/50 px-4 py-2.5">
              <div className="flex flex-1 items-center gap-2 text-sm">
                <IconChevronDownMedium
                  className="size-4 shrink-0 -rotate-90 text-sachi-fg-faint"
                  aria-hidden="true"
                />
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
                >
                  <Skeleton className="h-3 w-2" />
                </Badge>
                <span className="font-medium text-sachi-fg">{rule.label}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

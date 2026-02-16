import type { WorkItemWithAction } from "@nyte/domain/actions";
import { CalendarDaysIcon, MailIcon, WalletCardsIcon, XIcon } from "lucide-react";

import {
  NeedsYouActionContent,
  NeedsYouPrimaryActionIcon,
} from "~/components/needs-you-action-content";
import {
  primaryActionLabel,
  secondaryActionLabel,
} from "~/lib/needs-you/presenters";

const GHOST_BUTTON_CLASS =
  "group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5";

const PRIMARY_BUTTON_CLASS =
  "group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5";

type NeedsYouCardProps = {
  item: WorkItemWithAction;
  onApprove: (item: WorkItemWithAction) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

function SourceIcon({ item }: { item: WorkItemWithAction }) {
  if (item.type === "calendar") {
    return <CalendarDaysIcon className="size-3.5" />;
  }

  if (item.type === "refund") {
    return <WalletCardsIcon className="size-3.5" />;
  }

  return <MailIcon className="size-3.5" />;
}

export function NeedsYouCard({ item, onApprove, onDismiss }: NeedsYouCardProps) {
  return (
    <article className="transition-transform duration-75 group/mailcard flex flex-col gap-0.5 overflow-hidden rounded-xl bg-surface-subtle bg-card/65 p-0.5">
      <div className="bg-surface ease-out-expo flex flex-col gap-1 rounded-[10px] bg-background p-2 text-sm transition-transform duration-75 select-none hover:cursor-pointer hover:shadow-md">
        <div className="leading-relaxed overflow-hidden px-1 py-1">
          <span className="border-neutral mr-1.5 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-px shadow-xs align-middle">
            <span className="text-sm text-foreground">{item.actor}</span>
          </span>

          <span className="text-neutral-subtle mr-1.5 inline-flex items-center gap-1.5 align-middle text-muted-foreground">
            from
            <span className="border-neutral inline-flex items-center gap-1 rounded-lg border border-border bg-muted/70 px-1.5 py-px shadow-xs">
              <SourceIcon item={item} />
              <span className="text-sm text-foreground px-0.5">{item.source}</span>
            </span>
          </span>

          <span className="text-neutral-subtle align-middle text-muted-foreground">
            {item.summary}
          </span>
        </div>
      </div>

      <div className="rounded-xl">
        <div className="bg-surface-subtle flex items-center justify-between gap-3 rounded-lg bg-muted/70 p-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <NeedsYouActionContent item={item} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className={`${GHOST_BUTTON_CLASS} hidden sm:inline-flex`}
              onClick={() => onDismiss(item)}
            >
              <span className="absolute inset-0 rounded-lg border border-transparent bg-muted transition group-hover/button:border-border group-hover/button:bg-background group-hover/button:shadow-xs" />
              <span className="relative z-10 flex items-center gap-1 text-sm text-foreground">
                <XIcon className="size-3.5" />
                <span className="px-0.5 leading-none">
                  {secondaryActionLabel(item)}
                </span>
              </span>
            </button>

            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => onApprove(item)}
            >
              <span className="absolute inset-0 rounded-lg border border-border bg-gradient-to-t from-background to-background shadow-xs transition group-hover/button:to-muted" />
              <span className="relative z-10 flex items-center gap-1 text-sm text-foreground">
                <NeedsYouPrimaryActionIcon item={item} />
                <span className="px-0.5 leading-none">{primaryActionLabel(item)}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

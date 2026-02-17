import type { QueueActionItem } from "@nyte/workflows";
import { CalendarDaysIcon, MailIcon, PenLineIcon, WalletCardsIcon } from "lucide-react";

import { actionContentViewModel } from "~/lib/needs-you/presenters";

type ActionContentProps = {
  item: QueueActionItem;
};

type DraftActionContentProps = {
  preview: string;
};

type CalendarActionContentProps = {
  day: string;
  time: string;
};

type RefundActionContentProps = {
  amount: number;
  customerName: string;
};

function DraftActionContent({ preview }: DraftActionContentProps) {
  return (
    <>
      <PenLineIcon className="size-4 shrink-0 text-purple-600" />
      <span className="shrink-0 text-sm text-foreground">Draft</span>
      <span className="max-w-[100px] truncate text-sm text-muted-foreground sm:max-w-none">
        {preview}
      </span>
    </>
  );
}

function CalendarActionContent({ day, time }: CalendarActionContentProps) {
  return (
    <>
      <CalendarDaysIcon className="size-4 shrink-0 text-foreground" />
      <span className="shrink-0 text-sm text-foreground">{day}</span>
      <span className="text-sm text-muted-foreground">{time}</span>
    </>
  );
}

function RefundActionContent({ amount, customerName }: RefundActionContentProps) {
  return (
    <>
      <WalletCardsIcon className="size-4 shrink-0 text-foreground" />
      <span className="shrink-0 text-sm text-muted-foreground">Refund</span>
      <span className="shrink-0 text-sm text-foreground">${amount}</span>
      <span className="shrink-0 text-sm text-muted-foreground">to</span>
      <span className="text-sm text-foreground">{customerName}</span>
    </>
  );
}

export function NeedsYouActionContent({ item }: ActionContentProps) {
  const action = actionContentViewModel(item);

  if (action.mode === "calendar") {
    return <CalendarActionContent day={action.day} time={action.time} />;
  }

  if (action.mode === "refund") {
    return <RefundActionContent amount={action.amount} customerName={action.customerName} />;
  }

  return <DraftActionContent preview={action.preview} />;
}

export function NeedsYouPrimaryActionIcon({ item }: ActionContentProps) {
  if (item.type === "calendar") {
    return <CalendarDaysIcon className="size-3.5" />;
  }

  if (item.type === "refund") {
    return <WalletCardsIcon className="size-3.5" />;
  }

  return <MailIcon className="size-3.5" />;
}

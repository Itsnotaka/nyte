"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";

import { Card } from "./card";
import { useFeedContext } from "./feed-provider";

type WorkItemCardProps = {
  item: WorkItemWithAction;
};

type VariantProps = {
  item: WorkItemWithAction;
  isPending: boolean;
  onApprove: () => void;
  onDismiss: () => void;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function DraftCard({ item, isPending, onApprove, onDismiss }: VariantProps) {
  const payload =
    item.proposedAction.kind === "gmail.createDraft"
      ? item.proposedAction
      : null;

  const preview = payload
    ? `To: ${payload.to.join(", ")} • ${payload.subject}`
    : item.preview;

  return (
    <Card.Frame>
      <Card.Header
        actor={item.actor}
        source={item.source}
        summary={item.summary}
        gates={item.gates}
      />
      <Card.Preview label="Draft" value={preview} />
      <Card.Actions
        primaryLabel={item.cta}
        secondaryLabel={item.secondaryLabel}
        disabled={isPending}
        isPending={isPending}
        onPrimaryClick={onApprove}
        onSecondaryClick={onDismiss}
      />
    </Card.Frame>
  );
}

function CalendarCard({ item, isPending, onApprove, onDismiss }: VariantProps) {
  const payload =
    item.proposedAction.kind === "google-calendar.createEvent"
      ? item.proposedAction
      : null;

  const preview = payload
    ? `${payload.title} • ${formatTimestamp(payload.startsAt)}`
    : item.preview;

  return (
    <Card.Frame>
      <Card.Header
        actor={item.actor}
        source={item.source}
        summary={item.summary}
        gates={item.gates}
      />
      <Card.Preview label="Event" value={preview} />
      <Card.Actions
        primaryLabel={item.cta}
        secondaryLabel={item.secondaryLabel}
        disabled={isPending}
        isPending={isPending}
        onPrimaryClick={onApprove}
        onSecondaryClick={onDismiss}
      />
    </Card.Frame>
  );
}

function RefundCard({ item, isPending, onApprove, onDismiss }: VariantProps) {
  const payload =
    item.proposedAction.kind === "billing.queueRefund"
      ? item.proposedAction
      : null;

  const preview = payload
    ? `${payload.customerName} • $${payload.amount.toFixed(2)} ${payload.currency}`
    : item.preview;

  return (
    <Card.Frame>
      <Card.Header
        actor={item.actor}
        source={item.source}
        summary={item.summary}
        gates={item.gates}
      />
      <Card.Preview label="Refund" value={preview} />
      <Card.Actions
        primaryLabel={item.cta}
        secondaryLabel={item.secondaryLabel}
        disabled={isPending}
        isPending={isPending}
        onPrimaryClick={onApprove}
        onSecondaryClick={onDismiss}
      />
    </Card.Frame>
  );
}

export function WorkItemCard({ item }: WorkItemCardProps) {
  const { approve, dismiss, pendingIds } = useFeedContext();
  const isPending = pendingIds.has(item.id);

  const variantProps: VariantProps = {
    item,
    isPending,
    onApprove: () => {
      void approve(item.id);
    },
    onDismiss: () => {
      void dismiss(item.id);
    },
  };

  if (item.type === "calendar") {
    return <CalendarCard {...variantProps} />;
  }

  if (item.type === "refund") {
    return <RefundCard {...variantProps} />;
  }

  return <DraftCard {...variantProps} />;
}

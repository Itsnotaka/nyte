import type { QueueActionItem } from "@nyte/workflows";

import { NeedsYouCard } from "~/components/needs-you-card";

type NeedsYouListProps = {
  items: QueueActionItem[];
  onApprove: (item: QueueActionItem) => void;
  onDismiss: (item: QueueActionItem) => void;
};

export function NeedsYouList({ items, onApprove, onDismiss }: NeedsYouListProps) {
  return (
    <section className="mt-8 space-y-2 overflow-hidden">
      {items.map((item) => (
        <NeedsYouCard key={item.id} item={item} onApprove={onApprove} onDismiss={onDismiss} />
      ))}
    </section>
  );
}

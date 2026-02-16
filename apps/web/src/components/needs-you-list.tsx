import type { WorkItemWithAction } from "@nyte/domain/actions";

import { NeedsYouCard } from "~/components/needs-you-card";

type NeedsYouListProps = {
  items: WorkItemWithAction[];
  onApprove: (item: WorkItemWithAction) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

export function NeedsYouList({
  items,
  onApprove,
  onDismiss,
}: NeedsYouListProps) {
  return (
    <section className="mt-8 space-y-2 overflow-hidden">
      {items.map((item) => (
        <NeedsYouCard
          key={item.id}
          item={item}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      ))}
    </section>
  );
}

import type { WorkItemWithAction } from "@nyte/domain/actions";

import { ActionCard } from "~/components/action-card";

type ActionListProps = {
  items: WorkItemWithAction[];
  onApprove: (item: WorkItemWithAction, payloadOverride?: WorkItemWithAction["proposedAction"]) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

export function ActionList({ items, onApprove, onDismiss }: ActionListProps) {
  return (
    <div className="flex flex-col divide-y divide-[#141414]">
      {items.map((item) => (
        <ActionCard key={item.id} item={item} onApprove={onApprove} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

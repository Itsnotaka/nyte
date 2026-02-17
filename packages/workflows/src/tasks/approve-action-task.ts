import { approveWorkItem } from "@nyte/application/actions";

import { dispatchApprovedActionToPi } from "../pi-dispatch";

type ApproveWorkItemParameters = Parameters<typeof approveWorkItem>;

export type ApproveActionTaskInput = {
  itemId: ApproveWorkItemParameters[0];
  now?: ApproveWorkItemParameters[1];
  idempotencyKey?: ApproveWorkItemParameters[2];
};

export async function approveActionTask({
  itemId,
  idempotencyKey,
  now = new Date(),
}: ApproveActionTaskInput) {
  const approvedItem = await approveWorkItem(itemId, now, idempotencyKey);
  const piExtension = await dispatchApprovedActionToPi({
    approvedItem,
  });

  return {
    ...approvedItem,
    piExtension,
  };
}

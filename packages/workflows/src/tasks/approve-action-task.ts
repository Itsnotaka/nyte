import { approveWorkItem } from "@nyte/application/actions";

import { dispatchApprovedActionToPi } from "../pi-dispatch";

type ApproveWorkItemParameters = Parameters<typeof approveWorkItem>;

export type ApproveActionTaskInput = {
  itemId: ApproveWorkItemParameters[0];
  now?: ApproveWorkItemParameters[1];
  idempotencyKey?: ApproveWorkItemParameters[2];
  payloadOverride?: ApproveWorkItemParameters[3];
  actorUserId?: string | null;
};

export async function approveActionTask({
  itemId,
  idempotencyKey,
  payloadOverride,
  actorUserId = null,
  now = new Date(),
}: ApproveActionTaskInput) {
  const approvedItem = await approveWorkItem(itemId, now, idempotencyKey, payloadOverride);
  const piExtension = await dispatchApprovedActionToPi({
    approvedItem,
    userId: actorUserId,
  });

  return {
    ...approvedItem,
    piExtension,
  };
}

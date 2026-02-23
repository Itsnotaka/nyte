import { approveWorkItem } from "@nyte/application/actions/approve";
import { requireUserId } from "@nyte/application/identity/user-id";

import { dispatchApprovedActionToExtension } from "../extension-dispatch";

type ApproveWorkItemParameters = Parameters<typeof approveWorkItem>;

export type ApproveActionTaskInput = {
  itemId: ApproveWorkItemParameters[0];
  now?: ApproveWorkItemParameters[1];
  idempotencyKey?: ApproveWorkItemParameters[2];
  payloadOverride?: ApproveWorkItemParameters[3];
  actorUserId: string;
};

export async function approveActionTask({
  itemId,
  idempotencyKey,
  payloadOverride,
  actorUserId,
  now = new Date(),
}: ApproveActionTaskInput) {
  const normalizedActorUserId = requireUserId(actorUserId);
  const approvedItem = await approveWorkItem(
    itemId,
    now,
    idempotencyKey,
    payloadOverride
  );
  const extensionResult = await dispatchApprovedActionToExtension({
    approvedItem,
    userId: normalizedActorUserId,
  });

  return {
    ...approvedItem,
    extensionResult,
  };
}

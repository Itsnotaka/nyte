import { approveWorkItem } from "@nyte/application/actions";

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
  return approveWorkItem(itemId, now, idempotencyKey);
}

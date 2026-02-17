import { approveWorkItem } from "@nyte/application/actions";

export type ApproveActionTaskInput = {
  itemId: string;
  idempotencyKey?: string;
  now?: Date;
};

export async function approveActionTask({
  itemId,
  idempotencyKey,
  now = new Date(),
}: ApproveActionTaskInput) {
  return approveWorkItem(itemId, now, idempotencyKey);
}

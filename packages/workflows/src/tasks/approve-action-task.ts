import { approveWorkItem } from "@nyte/application/actions/approve";
import { Effect } from "effect";

import { dispatchApprovedActionToExtension } from "../extension-dispatch";
import { runWorkflowEffect } from "../effect-runtime";

type ApproveWorkItemParameters = Parameters<typeof approveWorkItem>;

export type ApproveActionTaskInput = {
  itemId: ApproveWorkItemParameters[0];
  now?: ApproveWorkItemParameters[1];
  idempotencyKey?: ApproveWorkItemParameters[2];
  payloadOverride?: ApproveWorkItemParameters[3];
  actorUserId?: string | null;
};

export function approveActionTaskProgram({
  itemId,
  idempotencyKey,
  payloadOverride,
  actorUserId = null,
  now = new Date(),
}: ApproveActionTaskInput) {
  return Effect.gen(function* () {
    const approvedItem = yield* Effect.tryPromise(() =>
      approveWorkItem(itemId, now, idempotencyKey, payloadOverride)
    );
    const extensionResult = yield* Effect.tryPromise(() =>
      dispatchApprovedActionToExtension({
        approvedItem,
        userId: actorUserId,
      })
    );

    return {
      ...approvedItem,
      extensionResult,
    };
  });
}

export async function approveActionTask(input: ApproveActionTaskInput) {
  return runWorkflowEffect(approveActionTaskProgram(input));
}

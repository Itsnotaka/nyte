import { dismissWorkItem } from "@nyte/application/actions/dismiss";
import { Effect } from "effect";

import { runWorkflowEffect } from "../effect-runtime";

type DismissWorkItemParameters = Parameters<typeof dismissWorkItem>;

export type DismissActionTaskInput = {
  itemId: DismissWorkItemParameters[0];
  now?: DismissWorkItemParameters[1];
};

export function dismissActionTaskProgram({
  itemId,
  now = new Date(),
}: DismissActionTaskInput) {
  return Effect.tryPromise(() => dismissWorkItem(itemId, now));
}

export async function dismissActionTask(input: DismissActionTaskInput) {
  return runWorkflowEffect(dismissActionTaskProgram(input));
}

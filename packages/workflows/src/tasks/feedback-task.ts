import { recordFeedback } from "@nyte/application/actions/feedback";
import { Effect } from "effect";

import { runWorkflowEffect } from "../effect-runtime";

type RecordFeedbackParameters = Parameters<typeof recordFeedback>;

export type FeedbackTaskInput = {
  itemId: RecordFeedbackParameters[0];
  rating: RecordFeedbackParameters[1];
  note?: RecordFeedbackParameters[2];
  now?: RecordFeedbackParameters[3];
};

export function feedbackTaskProgram({
  itemId,
  rating,
  note,
  now = new Date(),
}: FeedbackTaskInput) {
  return Effect.tryPromise(() => recordFeedback(itemId, rating, note, now));
}

export async function feedbackTask(input: FeedbackTaskInput) {
  return runWorkflowEffect(feedbackTaskProgram(input));
}

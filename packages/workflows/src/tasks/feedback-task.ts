import { recordFeedback } from "@nyte/application/actions/feedback";

type RecordFeedbackParameters = Parameters<typeof recordFeedback>;

export type FeedbackTaskInput = {
  itemId: RecordFeedbackParameters[0];
  rating: RecordFeedbackParameters[1];
  note?: RecordFeedbackParameters[2];
  now?: RecordFeedbackParameters[3];
};

export async function feedbackTask({
  itemId,
  rating,
  note,
  now = new Date(),
}: FeedbackTaskInput) {
  return recordFeedback(itemId, rating, note, now);
}

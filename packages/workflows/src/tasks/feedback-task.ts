import { recordFeedback, type FeedbackRating } from "@nyte/application/actions";

export type FeedbackTaskInput = {
  itemId: string;
  rating: FeedbackRating;
  note?: string;
  now?: Date;
};

export async function feedbackTask({ itemId, rating, note, now = new Date() }: FeedbackTaskInput) {
  return recordFeedback(itemId, rating, note, now);
}

import { dismissWorkItem } from "@nyte/application/actions";

export type DismissActionTaskInput = {
  itemId: string;
  now?: Date;
};

export async function dismissActionTask({ itemId, now = new Date() }: DismissActionTaskInput) {
  return dismissWorkItem(itemId, now);
}

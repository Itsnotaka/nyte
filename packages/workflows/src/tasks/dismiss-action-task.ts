import { dismissWorkItem } from "@nyte/application/actions";

type DismissWorkItemParameters = Parameters<typeof dismissWorkItem>;

export type DismissActionTaskInput = {
  itemId: DismissWorkItemParameters[0];
  now?: DismissWorkItemParameters[1];
};

export async function dismissActionTask({ itemId, now = new Date() }: DismissActionTaskInput) {
  return dismissWorkItem(itemId, now);
}

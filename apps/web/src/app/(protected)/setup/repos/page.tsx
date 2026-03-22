import { redirect } from "next/navigation";

import { getRepoCatalog, getSyncedRepoCatalog } from "~/lib/github/server";

import { RepoPickerView } from "../_components/repo-picker-view";

export default async function ReposPage() {
  const catalog = await getRepoCatalog();

  if (catalog.installations.length === 0) {
    redirect("/setup");
  }

  const syncedCatalog = await getSyncedRepoCatalog();

  return (
    <RepoPickerView
      entries={catalog.entries}
      syncedRepoIds={Array.from(syncedCatalog.syncedRepoIds)}
    />
  );
}

import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";

import { AppShell } from "./app-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}

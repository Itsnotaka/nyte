import { redirect } from "next/navigation";

import { isAuthenticated } from "~/lib/auth-server";

import { AppShell } from "./app-shell";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}

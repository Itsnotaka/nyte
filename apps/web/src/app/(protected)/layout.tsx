import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/lib/auth";

import { AppShellClient } from "./app-shell-client";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const interfaceTheme: "light" | "dark" = "light";

  return (
    <AppShellClient interfaceTheme={interfaceTheme}>{children}</AppShellClient>
  );
}

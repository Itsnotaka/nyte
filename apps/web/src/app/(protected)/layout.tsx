import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getUserSession } from "~/lib/auth/server";

import { AppShell } from "./app-shell";

async function ProtectedShell({ children }: { children: React.ReactNode }) {
  const session = await getUserSession();
  if (!session) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}

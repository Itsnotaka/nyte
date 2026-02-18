import { SidebarProvider } from "@nyte/ui/components/sidebar";
import { SidebarTrigger } from "@nyte/ui/components/sidebar";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "~/components/app-sidebar";
import { auth } from "~/lib/auth";

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginView } from "~/components/login-view";
import { auth } from "~/lib/auth";

export default async function LoginPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    redirect("/");
  }

  return <LoginView />;
}

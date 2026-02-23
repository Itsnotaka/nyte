import { redirect } from "next/navigation";

import { LoginView } from "~/components/login-view";
import { isAuthenticated } from "~/lib/auth-server";

export default async function LoginPage() {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    redirect("/");
  }

  return <LoginView />;
}

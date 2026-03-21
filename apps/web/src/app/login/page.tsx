import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginView } from "~/components/login-view";
import { getUserSession } from "~/lib/auth/server";

async function LoginContent() {
  const session = await getUserSession();
  if (session) {
    redirect("/");
  }

  return <LoginView />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

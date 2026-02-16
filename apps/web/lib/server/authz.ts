import { auth } from "@/lib/auth";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function shouldEnforceAuthz() {
  if (process.env.NYTE_REQUIRE_AUTH === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

export async function requireAuthorizedSession(request: Request) {
  if (!shouldEnforceAuthz()) {
    return null;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    throw new AuthorizationError("Authentication required.");
  }

  return session;
}

import { auth } from "@/lib/auth";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthorizationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationServiceError";
  }
}

export function shouldEnforceAuthz() {
  if (process.env.NYTE_REQUIRE_AUTH === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

type ResolveSession = (request: Request) => Promise<unknown>;

const resolveSession: ResolveSession = (request) =>
  auth.api.getSession({
    headers: request.headers,
  });

type AuthorizationFailure = AuthorizationError | AuthorizationServiceError;

export function requireAuthorizedSession(
  request: Request,
  resolveAuthorizedSession: ResolveSession = resolveSession,
): ResultAsync<unknown, AuthorizationFailure> {
  if (!shouldEnforceAuthz()) {
    return okAsync(null);
  }

  return ResultAsync.fromPromise(
    resolveAuthorizedSession(request),
    () => new AuthorizationServiceError("Failed to resolve authenticated session."),
  ).andThen((session) => {
    if (!session) {
      return errAsync(new AuthorizationError("Authentication required."));
    }
    return okAsync(session);
  });
}

export function createAuthorizationErrorResponse(error: AuthorizationFailure) {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  return Response.json({ error: "Failed to validate authorization." }, { status: 500 });
}

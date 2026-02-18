import { auth } from "~/lib/auth";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";

export type TRPCContext = {
  userId: string | null;
  request: Request;
};

export async function createContext(request: Request): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = resolveSessionUserId(session);

  return { userId, request };
}

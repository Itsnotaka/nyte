import { auth } from "~/lib/auth";

export type TRPCContext = {
  userId: string | null;
  request: Request;
};

export async function createContext(request: Request): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id?.trim() || null;

  return { userId, request };
}

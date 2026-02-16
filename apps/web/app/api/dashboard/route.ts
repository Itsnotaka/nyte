import { getDashboardData } from "@/lib/server/dashboard";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  const dashboard = await getDashboardData();
  return Response.json(dashboard);
}

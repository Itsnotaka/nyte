import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { getTrustReport } from "@/lib/server/trust-report";

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  const report = await getTrustReport(new Date());
  return Response.json(report);
}

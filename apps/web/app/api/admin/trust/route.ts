import { getTrustReport } from "@/lib/server/trust-report";

export async function GET() {
  const report = await getTrustReport(new Date());
  return Response.json(report);
}

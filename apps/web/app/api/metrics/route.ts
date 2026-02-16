import { getMetricsSnapshot } from "@/lib/server/metrics";

export async function GET() {
  const metrics = await getMetricsSnapshot(new Date());
  return Response.json(metrics);
}

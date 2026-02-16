import { getDashboardData } from "@/lib/server/dashboard";

export async function GET() {
  const dashboard = await getDashboardData();
  return Response.json(dashboard);
}

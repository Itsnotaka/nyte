import { type NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  if (setupAction === "install" && installationId) {
    return NextResponse.redirect(new URL("/setup/repos", request.url));
  }

  return NextResponse.redirect(new URL("/setup", request.url));
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/server/security-headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  applySecurityHeaders(response.headers, { isApiRoute });
  return response;
}

export const config = {
  matcher: "/:path*",
};

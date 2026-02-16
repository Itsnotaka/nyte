type SecurityHeaderOptions = {
  isApiRoute: boolean;
};

export function applySecurityHeaders(headers: Headers, { isApiRoute }: SecurityHeaderOptions) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), microphone=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (isApiRoute) {
    headers.set("Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
  }
}

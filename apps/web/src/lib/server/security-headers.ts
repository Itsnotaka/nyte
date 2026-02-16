type SecurityHeaderOptions = {
  isApiRoute: boolean;
};

export function applySecurityHeaders(headers: Headers, { isApiRoute }: SecurityHeaderOptions) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
  );
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

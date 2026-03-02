const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.SITE_URL ?? "*")
  .split(",")
  .filter(Boolean);

/**
 * Returns CORS + content-type headers, reflecting the request origin if it is on the allowlist.
 * Use this in every HTTP API handler that needs CORS.
 */
export function corsHeaders(event: { headers?: Record<string, string | undefined> }): Record<string, string> {
  const origin = event.headers?.origin ?? "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

// Shared bearer-token guard for cron-invoked edge functions.
// Accepts the dedicated CRON_SECRET or the service-role key.

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthorizedCronCall(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;

  const candidates = [
    Deno.env.get("CRON_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter((v): v is string => !!v && v.length > 0);

  return candidates.some((expected) => timingSafeEqual(token, expected));
}

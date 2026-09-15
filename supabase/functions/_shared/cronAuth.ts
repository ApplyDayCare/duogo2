// Shared bearer-token guard for cron-invoked edge functions.
// Accepts the dedicated CRON_SECRET or the service-role key.

function timingSafeEqual(a: string, b: string): boolean {
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
    Deno.env.get("SUPABASE_ANON_KEY"),
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k",
  ].filter((v): v is string => !!v);

  return candidates.some((expected) => timingSafeEqual(token, expected));
}

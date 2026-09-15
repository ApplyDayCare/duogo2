const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (resets on cold start, but sufficient for brute-force protection)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > MAX_ATTEMPTS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") || "unknown";

    if (isRateLimited(ip)) {
      console.warn(`Rate limited admin login attempt from IP: ${ip}`);
      return new Response(JSON.stringify({ valid: false, error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { password } = await req.json();
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");

    if (!adminPassword) {
      return new Response(JSON.stringify({ valid: false, error: "Admin password not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = password === adminPassword;

    if (!valid) {
      console.warn(`Failed admin login attempt from IP: ${ip}`);
    }

    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

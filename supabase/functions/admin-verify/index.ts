const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inlined timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Simple in-memory rate limiter with namespaced keys
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  record.count++;
  return record.count > maxAttempts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") || "unknown";

    if (isRateLimited(`admin-verify:${ip}`)) {
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

    const valid = typeof password === "string" && timingSafeEqual(password, adminPassword);

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

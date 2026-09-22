import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlined timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Inlined in-memory rate limiter with namespaced keys
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, report_id, user_id, password } = await req.json();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") || "unknown";

    if (isRateLimited(`admin-reports:${ip}`)) {
      console.warn(`Rate limited admin reports attempt from IP: ${ip}`);
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin password on every request with timing-safe comparison
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || typeof password !== "string" || !timingSafeEqual(password, adminPassword)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "list") {
      // Cap rows returned to limit PII exposure per request.
      const { data: reports } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!reports) {
        return new Response(JSON.stringify({ reports: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch reporter and reported user details
      const userIds = [
        ...new Set([
          ...reports.map((r: any) => r.reporter_id),
          ...reports.map((r: any) => r.reported_user_id),
        ]),
      ].filter(Boolean);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, email, user_type")
        .in("id", userIds);

      // Partially mask emails in the response to limit PII exposure in transit.
      const maskEmail = (email?: string | null) => {
        if (!email) return "";
        const [local, domain] = email.split("@");
        if (!domain) return "***";
        return `${local.slice(0, 2)}***@${domain}`;
      };

      const profileMap = new Map((profiles || []).map((p: any) => [
        p.id,
        { ...p, email: maskEmail(p.email) },
      ]));

      const enriched = reports.map((r: any) => ({
        ...r,
        reporter: profileMap.get(r.reporter_id) || null,
        reported_user: profileMap.get(r.reported_user_id) || null,
      }));

      return new Response(JSON.stringify({ reports: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "dismiss" && report_id) {
      await supabase
        .from("reports")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", report_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "suspend" && user_id) {
      // Suspend profile
      await supabase
        .from("profiles")
        .update({ is_suspended: true, suspended_at: new Date().toISOString() })
        .eq("id", user_id);

      // Mark related reports as resolved
      if (report_id) {
        await supabase
          .from("reports")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", report_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify admin password on every request
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
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

      const userIds = [...new Set(reports.flatMap((r: any) => [r.reporter_id, r.reported_user_id]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Redact emails for display: keep enough context to identify the user
      // without dumping full PII into the admin UI.
      const redactEmail = (email: string | null | undefined) => {
        if (!email) return "";
        const [local, domain] = email.split("@");
        if (!domain) return "***";
        const safeLocal = local.length <= 2 ? local[0] + "*" : `${local.slice(0, 2)}***`;
        return `${safeLocal}@${domain}`;
      };

      const enriched = reports.map((r: any) => ({
        ...r,
        reporter_name: profileMap.get(r.reporter_id)?.first_name ?? "Unknown",
        reporter_email: redactEmail(profileMap.get(r.reporter_id)?.email),
        reported_name: profileMap.get(r.reported_user_id)?.first_name ?? "Unknown",
        reported_email: redactEmail(profileMap.get(r.reported_user_id)?.email),
      }));

      return new Response(JSON.stringify({ reports: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "suspend" && user_id) {
      await supabase.from("profiles").update({
        is_suspended: true,
        suspension_reason: "Suspended by admin review",
        suspended_at: new Date().toISOString(),
        matching_paused: true,
      }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((action === "dismiss" || action === "resolve") && report_id) {
      await supabase.from("reports").update({
        status: action === "dismiss" ? "dismissed" : "resolved",
        reviewed_at: new Date().toISOString(),
      }).eq("id", report_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

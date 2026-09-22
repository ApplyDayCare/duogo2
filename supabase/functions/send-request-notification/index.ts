import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlined sanitization helpers
function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeName(input: unknown, fallback = "User"): string {
  const raw = (input ?? "").toString().replace(/[<>&"'`\u0000-\u001F\u007F]/g, "").trim();
  const cleaned = raw.slice(0, 60).trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify caller's JWT
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const { targetUserId, senderUserId, compatibilityScore } = await req.json();

    if (!targetUserId || !senderUserId) {
      return new Response(JSON.stringify({ error: "targetUserId and senderUserId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verify caller is genuinely senderUserId
    if (callerUser.id !== senderUserId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Caller identity does not match senderUserId" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Verify match record exists and sender has actively sent 'accept'
    const { data: matchRecord, error: matchErr } = await adminClient
      .from("matches")
      .select("id, status, user_a_id, user_b_id, user_a_action, user_b_action, compatibility_score")
      .or(
        `and(user_a_id.eq.${senderUserId},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${senderUserId})`
      )
      .maybeSingle();

    if (matchErr || !matchRecord) {
      return new Response(
        JSON.stringify({ error: "Forbidden: No match request found between sender and target" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isSenderUserA = matchRecord.user_a_id === senderUserId;
    const senderAction = isSenderUserA ? matchRecord.user_a_action : matchRecord.user_b_action;

    if (senderAction !== "accept") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Sender has not sent an accept connection request" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Retrieve target user profile
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("profiles")
      .select("id, first_name, email, user_type")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetErr || !targetProfile || !targetProfile.email) {
      return new Response(
        JSON.stringify({ success: false, reason: "Target user profile or email could not be resolved" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Retrieve sender user profile & couple partner name if applicable
    const { data: senderProfile } = await adminClient
      .from("profiles")
      .select("id, first_name, user_type")
      .eq("id", senderUserId)
      .maybeSingle();

    let senderDisplayName = safeName(senderProfile?.first_name, "Someone");

    if (senderProfile?.user_type === "couple") {
      const { data: couple } = await adminClient
        .from("couples")
        .select("partner_a_id, partner_b_id")
        .or(`partner_a_id.eq.${senderUserId},partner_b_id.eq.${senderUserId}`)
        .maybeSingle();

      if (couple) {
        const partnerId = couple.partner_a_id === senderUserId ? couple.partner_b_id : couple.partner_a_id;
        if (partnerId) {
          const { data: partnerProfile } = await adminClient
            .from("profiles")
            .select("first_name")
            .eq("id", partnerId)
            .maybeSingle();

          if (partnerProfile?.first_name) {
            senderDisplayName = `${senderDisplayName} & ${safeName(partnerProfile.first_name, "Partner")}`;
          }
        }
      }
    }

    const recipientFirstName = safeName(targetProfile.first_name, "Friend");
    const appUrl = Deno.env.get("APP_URL") || "https://duogo.app";

    const resolvedScore =
      typeof compatibilityScore === "number" && compatibilityScore > 0
        ? compatibilityScore
        : matchRecord.compatibility_score;

    const scoreBadge =
      typeof resolvedScore === "number" && resolvedScore > 0
        ? `<p style="font-size: 15px; color: #e84a2b; font-weight: 700; margin: 4px 0 16px 0;">✨ ${Math.round(resolvedScore)}% Compatibility Match</p>`
        : "";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #f0eee9;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px;">✨</span>
          <h1 style="color: #1A1816; font-size: 24px; font-weight: 800; margin: 12px 0 4px 0;">New Connection Request</h1>
          <p style="color: #706A62; font-size: 15px; margin: 0;">Someone in your local area wants to connect on duogo</p>
        </div>

        <div style="background-color: #FAF7F2; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #EDE8E1; text-align: center;">
          <p style="font-size: 17px; color: #1A1816; line-height: 1.5; margin: 0 0 8px 0;">
            Hi <strong>${escapeHtml(recipientFirstName)}</strong>,
          </p>
          <p style="font-size: 16px; color: #403B35; line-height: 1.6; margin: 0;">
            <strong>${escapeHtml(senderDisplayName)}</strong> reviewed your profile and sent you a connection request!
          </p>
          ${scoreBadge}
          <div style="margin-top: 24px;">
            <a href="${escapeHtml(appUrl)}/matches?tab=received" style="display: inline-block; background-color: #FF5436; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(255,84,54,0.25);">
              Review & Connect Back
            </a>
          </div>
        </div>

        <div style="padding: 16px 0; border-top: 1px solid #F0ECE4; text-align: center;">
          <p style="font-size: 13px; color: #8C847B; margin: 0 0 6px 0;">
            You can accept or decline anytime inside your <strong>Received</strong> tab.
          </p>
          <p style="font-size: 12px; color: #B3ABA0; margin: 0;">
            duogo · Authentic Social Friendships & Pair Gatherings
          </p>
        </div>
      </div>
    `;

    const subject = `✨ ${senderDisplayName} sent you a connection request on duogo!`;

    // 7. Send email via Resend or Brevo
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

    if (!RESEND_API_KEY && !BREVO_API_KEY) {
      console.log("Neither RESEND_API_KEY nor BREVO_API_KEY configured: skipping email send");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No email provider configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const SENDER_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || Deno.env.get("BREVO_FROM_EMAIL") || "hello@duogo.app";
    const SENDER_NAME = Deno.env.get("BREVO_FROM_NAME") || Deno.env.get("RESEND_FROM_NAME") || "duogo";

    let emailResult: any = null;

    if (RESEND_API_KEY) {
      try {
        const from = SENDER_EMAIL.includes("<") ? SENDER_EMAIL : `${SENDER_NAME} <${SENDER_EMAIL}>`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [targetProfile.email],
            subject,
            html: htmlContent,
          }),
        });
        emailResult = await res.json();
      } catch (e) {
        console.error("Resend API error:", e);
      }
    } else if (BREVO_API_KEY) {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: targetProfile.email, name: recipientFirstName }],
            subject,
            htmlContent,
          }),
        });
        emailResult = await res.json();
      } catch (e) {
        console.error("Brevo API error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        recipient: targetProfile.email,
        result: emailResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("send-request-notification error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

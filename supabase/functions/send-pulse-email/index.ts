import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, safeName } from "../_shared/sanitize.ts";
import { isAuthorizedCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find mutual matches where revealed_at was ~7 days ago and no pulse feedback yet
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dayStart = new Date(sevenDaysAgo);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sevenDaysAgo);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id, user_a_id, user_b_id, revealed_at")
      .eq("status", "mutual")
      .gte("revealed_at", dayStart.toISOString())
      .lte("revealed_at", dayEnd.toISOString());

    if (matchErr) {
      console.error("Error fetching matches:", matchErr);
      return new Response(JSON.stringify({ error: matchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No matches due for pulse email today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      console.log("BREVO_API_KEY not configured: skipping");
      return new Response(JSON.stringify({ sent: 0, skipped: true, reason: "No email API key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SENDER_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "hello@duogo.app";
    const SENDER_NAME = Deno.env.get("BREVO_FROM_NAME") || "duogo";
    const APP_URL = Deno.env.get("APP_URL") || "https://duogo.space";
    let sentCount = 0;

    for (const match of matches) {
      // Check if either user already submitted feedback
      const { data: existingFeedback } = await supabase
        .from("pulse_feedback")
        .select("user_id")
        .eq("match_id", match.id);

      const feedbackUserIds = new Set((existingFeedback || []).map((f: any) => f.user_id));
      const usersToEmail = [match.user_a_id, match.user_b_id].filter(
        (uid) => !feedbackUserIds.has(uid)
      );

      if (usersToEmail.length === 0) continue;

      // Get profiles for both users
      const { data: profileA } = await supabase
        .from("profiles")
        .select("first_name, email, user_type")
        .eq("id", match.user_a_id)
        .single();

      const { data: profileB } = await supabase
        .from("profiles")
        .select("first_name, email, user_type")
        .eq("id", match.user_b_id)
        .single();

      if (!profileA || !profileB) continue;

      // Build match name helper
      const getDisplayName = async (userId: string, profile: any) => {
        if (profile.user_type !== "couple") return safeName(profile.first_name, "Your match");
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${userId},partner_b_id.eq.${userId}`)
          .maybeSingle();
        if (!couple) return safeName(profile.first_name, "Your match");
        const pid = couple.partner_a_id === userId ? couple.partner_b_id : couple.partner_a_id;
        if (!pid) return safeName(profile.first_name, "Your match");
        const { data: pp } = await supabase.from("profiles").select("first_name").eq("id", pid).single();
        return `${safeName(profile.first_name, "Partner 1")} & ${safeName(pp?.first_name, "Partner 2")}`;
      };

      const nameA = await getDisplayName(match.user_a_id, profileA);
      const nameB = await getDisplayName(match.user_b_id, profileB);

      const pulseLink = `${APP_URL}/pulse/${match.id}`;

      const buildEmailHtml = (recipientName: string, matchName: string) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff;">
          <h1 style="color: #e84a2b; text-align: center; font-size: 24px; margin-bottom: 24px;">
            Did you meet up with ${escapeHtml(matchName)}? 🤝
          </h1>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hi ${escapeHtml(recipientName)},
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            It's been a week since we matched you with <strong>${escapeHtml(matchName)}</strong>. We'd love to know how it went!
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${pulseLink}" style="display: inline-block; background-color: #e84a2b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
              Give 2-Minute Feedback
            </a>
          </div>
          
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            This helps us improve matches for everyone. Thanks!
          </p>
          
          <p style="font-size: 14px; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            duogo · Find your people.
          </p>
        </div>
      `;

      // Send to users who haven't submitted feedback yet
      for (const userId of usersToEmail) {
        const isA = userId === match.user_a_id;
        const recipientProfile = isA ? profileA : profileB;
        const matchName = isA ? nameB : nameA;

        // Insert in-app notification
        try {
          await supabase.from("notifications").insert({
            user_id: userId,
            message: `How did your meetup with ${matchName} go? Share your feedback! 💬`,
            link: `/pulse/${match.id}`,
          });
        } catch (notifErr) {
          console.error(`Failed to insert pulse notification for ${userId}:`, notifErr);
        }

        try {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": BREVO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: SENDER_NAME, email: SENDER_EMAIL },
              to: [{ email: recipientProfile.email }],
              subject: `Did you meet up with ${matchName}?`,
              htmlContent: buildEmailHtml(safeName(recipientProfile.first_name, "Friend"), matchName),
            }),
          });
          sentCount++;
        } catch (emailErr) {
          console.error(`Failed to send pulse email to ${recipientProfile.email}:`, emailErr);
        }
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, matchesChecked: matches.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pulse email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

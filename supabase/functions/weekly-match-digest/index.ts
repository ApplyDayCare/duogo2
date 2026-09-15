import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, safeName } from "../_shared/sanitize.ts";
import { SOLO_THRESHOLD, QuizRow, soloScore } from "../_shared/scoring.ts";
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

    // Find users who haven't been active in the last 3+ days and aren't suspended/paused
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: inactiveProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, first_name, email, user_type, location_city, travel_radius_km")
      .eq("quiz_completed", true)
      .eq("onboarding_completed", true)
      .eq("is_suspended", false)
      .eq("matching_paused", false)
      .lte("last_active", threeDaysAgo.toISOString());

    if (profileErr) {
      console.error("Error fetching profiles:", profileErr);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inactiveProfiles || inactiveProfiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No inactive users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all quiz responses for scoring
    const { data: allQuizzes } = await supabase.from("quiz_responses").select("*");
    const quizMap = new Map<string, QuizRow>();
    for (const q of allQuizzes || []) quizMap.set(q.user_id, q as QuizRow);

    // Get all existing matches to exclude
    const { data: allMatches } = await supabase.from("matches").select("user_a_id, user_b_id, status");

    // Get all blocks
    const { data: allBlocks } = await supabase.from("blocks").select("blocker_id, blocked_user_id");

    // Build block set for quick lookup
    const blockPairs = new Set<string>();
    for (const b of allBlocks || []) {
      blockPairs.add(`${b.blocker_id}:${b.blocked_user_id}`);
      blockPairs.add(`${b.blocked_user_id}:${b.blocker_id}`);
    }

    // Build existing match set
    const matchPairs = new Set<string>();
    for (const m of allMatches || []) {
      if (["mutual", "passed_by_a", "passed_by_b", "blocked"].includes(m.status)) {
        matchPairs.add(`${m.user_a_id}:${m.user_b_id}`);
        matchPairs.add(`${m.user_b_id}:${m.user_a_id}`);
      }
    }

    // Get all active solo profiles for potential matches
    const { data: allActiveProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, user_type")
      .eq("user_type", "solo")
      .eq("quiz_completed", true)
      .eq("is_suspended", false)
      .eq("matching_paused", false);

    const activeProfileMap = new Map<string, any>();
    for (const p of allActiveProfiles || []) activeProfileMap.set(p.id, p);

    let sentCount = 0;

    for (const profile of inactiveProfiles) {
      // Only handle solo users for now (couple matching is more complex)
      if (profile.user_type !== "solo") continue;

      const myQuiz = quizMap.get(profile.id);
      if (!myQuiz) continue;

      // Find top unmatched compatible users
      let topScore = 0;
      let topMatchCount = 0;

      for (const [otherId, otherQuiz] of quizMap.entries()) {
        if (otherId === profile.id) continue;
        if (!activeProfileMap.has(otherId)) continue;
        if (blockPairs.has(`${profile.id}:${otherId}`)) continue;
        if (matchPairs.has(`${profile.id}:${otherId}`)) continue;

        const otherProfile = activeProfileMap.get(otherId);
        if (otherProfile?.user_type !== "solo") continue;

        const score = soloScore(myQuiz, otherQuiz);
        if (score >= SOLO_THRESHOLD) {
          topMatchCount++;
          if (score > topScore) topScore = score;
        }
      }

      if (topMatchCount === 0) continue;

      // Send notification email
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff;">
          <h1 style="color: #e84a2b; text-align: center; font-size: 24px; margin-bottom: 24px;">
            You have ${topMatchCount} new potential match${topMatchCount > 1 ? "es" : ""}! 🎉
          </h1>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hi ${escapeHtml(safeName(profile.first_name, "there"))},
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            We found <strong>${topMatchCount} compatible match${topMatchCount > 1 ? "es" : ""}</strong> for you, 
            with compatibility scores up to <strong>${topScore}%</strong>!
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Don't miss out: check your matches and connect with someone new.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${APP_URL}/matches" style="display: inline-block; background-color: #e84a2b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
              View Your Matches
            </a>
          </div>
          
          <p style="font-size: 14px; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            duogo · Find your people.
          </p>
        </div>
      `;

      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: profile.email }],
            subject: `You have ${topMatchCount} new match${topMatchCount > 1 ? "es" : ""} waiting!`,
            htmlContent: html,
          }),
        });
        if (res.ok) sentCount++;
        else console.error(`Failed to send to ${profile.email}: ${res.status}`);
      } catch (emailErr) {
        console.error(`Email error for ${profile.email}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, checked: inactiveProfiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Weekly digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, safeName, safeSocialUrl } from "../_shared/sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get match
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (matchErr || !match || match.status !== "mutual") {
      return new Response(JSON.stringify({ error: "Match not found or not mutual" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is part of the match
    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both profiles
    const { data: profileA } = await supabase
      .from("profiles")
      .select("first_name, email, social_link, user_type, location_city")
      .eq("id", match.user_a_id)
      .single();

    const { data: profileB } = await supabase
      .from("profiles")
      .select("first_name, email, social_link, user_type, location_city")
      .eq("id", match.user_b_id)
      .single();

    if (!profileA || !profileB) {
      return new Response(JSON.stringify({ error: "Profiles not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For couple users, get partner info
    const getPartnerInfo = async (uid: string) => {
      const { data: couple } = await supabase
        .from("couples")
        .select("partner_a_id, partner_b_id")
        .or(`partner_a_id.eq.${uid},partner_b_id.eq.${uid}`)
        .maybeSingle();

      if (!couple) return null;
      const partnerId = couple.partner_a_id === uid ? couple.partner_b_id : couple.partner_a_id;
      if (!partnerId) return null;

      const { data: partner } = await supabase
        .from("profiles")
        .select("first_name, social_link")
        .eq("id", partnerId)
        .single();

      return partner;
    };

    const partnerA = profileA.user_type === "couple" ? await getPartnerInfo(match.user_a_id) : null;
    const partnerB = profileB.user_type === "couple" ? await getPartnerInfo(match.user_b_id) : null;

    const nameA = partnerA
      ? `${safeName(profileA.first_name)} & ${safeName(partnerA.first_name, "Partner")}`
      : safeName(profileA.first_name);

    const nameB = partnerB
      ? `${safeName(profileB.first_name)} & ${safeName(partnerB.first_name, "Partner")}`
      : safeName(profileB.first_name);

    const score = Math.round(Number(match.compatibility_score));

    const buildContactBlock = (profile: any, partner: any) => {
      const renderPerson = (name: string, socialLink: unknown) => {
        let out = `<strong>${escapeHtml(name)}</strong>`;
        const link = safeSocialUrl(socialLink);
        if (link) {
          out += ` : <a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
        }
        return out;
      };

      let block = renderPerson(safeName(profile.first_name), profile.social_link);
      if (partner) {
        block += `<br/>${renderPerson(safeName(partner.first_name, "Partner"), partner.social_link)}`;
      }
      return block;
    };

    const emailHtml = (recipientName: string, matchName: string, contactBlock: string) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff;">
        <h1 style="color: #e84a2b; text-align: center; font-size: 28px; margin-bottom: 8px;">🎉 It's a Match!</h1>
        <p style="text-align: center; color: #666; font-size: 16px; margin-bottom: 32px;">
          ${score}% compatible
        </p>
        
        <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(recipientName)},</p>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          Great news! You and <strong>${escapeHtml(matchName)}</strong> matched on duogo and you're ${score}% compatible!
        </p>
        
        <div style="background-color: #f8f5f2; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">Here's how to connect:</p>
          <p style="font-size: 15px; color: #333; margin: 0; line-height: 1.8;">
            ${contactBlock}
          </p>
        </div>

        <div style="margin: 24px 0;">
          <p style="font-size: 15px; color: #333; font-weight: 600;">What's next?</p>
          <ol style="font-size: 15px; color: #555; line-height: 1.8; padding-left: 20px;">
            <li>Check out their profile</li>
            <li>Reply-all to this email to say hi</li>
            <li>Suggest a time and place to meet!</li>
          </ol>
        </div>

        <p style="font-size: 14px; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          duogo · Find your people.
        </p>
      </div>
    `;

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      console.log("BREVO_API_KEY not configured: skipping email send");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No email API key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SENDER_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "hello@duogo.app";
    const SENDER_NAME = Deno.env.get("BREVO_FROM_NAME") || "duogo";

    const contactBlockForA = buildContactBlock(profileB, partnerB);
    const contactBlockForB = buildContactBlock(profileA, partnerA);

    const sendEmail = async (to: string, recipientName: string, matchName: string, contactBlock: string) => {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: SENDER_EMAIL },
          to: [{ email: to }],
          subject: `Your duogo Match: ${recipientName} ↔ ${matchName}`,
          htmlContent: emailHtml(recipientName, matchName, contactBlock),
        }),
      });
      return res.json();
    };

    const [resultA, resultB] = await Promise.all([
      sendEmail(profileA.email, safeName(profileA.first_name, "Friend"), nameB, contactBlockForA),
      sendEmail(profileB.email, safeName(profileB.first_name, "Friend"), nameA, contactBlockForB),
    ]);

    // Send push notifications to both users
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const sendPush = async (userId: string, matchName: string) => {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: "It's a match! 🎉",
            body: `You and ${matchName} are a match! Check your reveal now.`,
            url: `/match-reveal/${match.id}`,
          }),
        });
      } catch (e) {
        console.error("Push notification failed:", e);
      }
    };

    await Promise.all([
      sendPush(match.user_a_id, nameB),
      sendPush(match.user_b_id, nameA),
    ]);

    return new Response(JSON.stringify({ success: true, resultA, resultB }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

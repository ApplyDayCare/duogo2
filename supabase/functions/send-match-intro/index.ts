import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlined sanitization helpers for standalone web editor deployment
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

const ALLOWED_SOCIAL_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
];

function safeSocialUrl(input: unknown): string | null {
  if (!input) return null;
  let value = String(input).trim();
  if (value.length === 0 || value.length > 300) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!ALLOWED_SOCIAL_HOSTS.includes(url.hostname.toLowerCase())) return null;
  if (!/^[A-Za-z0-9/\-._~%]*$/.test(url.pathname)) return null;

  url.protocol = "https:";
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  return url.toString();
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

    const {
      data: { user: callerUser },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !callerUser) {
      console.warn("[send-match-intro] Caller token invalid or expired:", userErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = callerUser.id;

    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-match-intro] Invoked for match ${match_id} by user ${userId}`);

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
      console.warn(`[send-match-intro] Match ${match_id} not found or status is not mutual (status: ${match?.status})`);
      return new Response(JSON.stringify({ error: "Match not found or not mutual" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is part of the match
    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      console.warn(`[send-match-intro] Caller ${userId} is neither user_a nor user_b of match ${match_id}`);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both profiles
    const { data: profileA } = await supabase
      .from("profiles")
      .select("id, first_name, email, social_link, user_type, location_city")
      .eq("id", match.user_a_id)
      .single();

    const { data: profileB } = await supabase
      .from("profiles")
      .select("id, first_name, email, social_link, user_type, location_city")
      .eq("id", match.user_b_id)
      .single();

    if (!profileA || !profileB) {
      console.warn(`[send-match-intro] Profiles not found for match ${match_id}`);
      return new Response(JSON.stringify({ error: "Profiles not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: fetch email from auth.users if missing from profiles
    if (!profileA.email) {
      try {
        const { data: authA } = await supabase.auth.admin.getUserById(match.user_a_id);
        if (authA?.user?.email) profileA.email = authA.user.email;
      } catch (e) {
        console.warn("[send-match-intro] Could not resolve email for user A:", e);
      }
    }
    if (!profileB.email) {
      try {
        const { data: authB } = await supabase.auth.admin.getUserById(match.user_b_id);
        if (authB?.user?.email) profileB.email = authB.user.email;
      } catch (e) {
        console.warn("[send-match-intro] Could not resolve email for user B:", e);
      }
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
      console.warn("No BREVO_API_KEY configured: skipping email send");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No email API key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SENDER_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "sayhello@duogo.space";
    const SENDER_NAME = Deno.env.get("BREVO_FROM_NAME") || "Duogo";

    const contactBlockForA = buildContactBlock(profileB, partnerB);
    const contactBlockForB = buildContactBlock(profileA, partnerA);

    const sendEmail = async (to: string, recipientName: string, matchName: string, contactBlock: string) => {
      const subject = `Your duogo Match: ${recipientName} ↔ ${matchName}`;
      const content = emailHtml(recipientName, matchName, contactBlock);

      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: to, name: recipientName }],
            subject,
            htmlContent: content,
          }),
        });
        const json = await res.json().catch(() => null);
        console.log(`[send-match-intro] Brevo response for ${to}: status ${res.status}`, json);
        return { ok: res.ok, status: res.status, json };
      } catch (err) {
        console.error(`[send-match-intro] Brevo error for ${to}:`, err);
        return { ok: false, error: String(err) };
      }
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

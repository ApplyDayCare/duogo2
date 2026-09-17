import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, safeName } from "../_shared/sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_id, recipient_id, score, app_url } = await req.json();

    if (!recipient_id) {
      return new Response(JSON.stringify({ error: "recipient_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recipient's profile
    const { data: recipientProfile, error: recipientErr } = await supabase
      .from("profiles")
      .select("id, first_name, email, is_suspended")
      .eq("id", recipient_id)
      .single();

    if (recipientErr || !recipientProfile || !recipientProfile.email) {
      console.warn("Recipient profile or email not found:", recipientErr);
      return new Response(JSON.stringify({ error: "Recipient profile or email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipientProfile.is_suspended) {
      return new Response(JSON.stringify({ skipped: true, reason: "Recipient account is suspended" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sender's profile if available
    let senderName = "Someone nearby";
    let senderLocation = "";
    if (sender_id) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("id, first_name, user_type, location_city")
        .eq("id", sender_id)
        .maybeSingle();

      if (senderProfile) {
        senderLocation = senderProfile.location_city || "";
        if (senderProfile.user_type === "couple") {
          const { data: couple } = await supabase
            .from("couples")
            .select("partner_a_id, partner_b_id")
            .or(`partner_a_id.eq.${sender_id},partner_b_id.eq.${sender_id}`)
            .maybeSingle();

          if (couple) {
            const partnerId =
              couple.partner_a_id === sender_id ? couple.partner_b_id : couple.partner_a_id;
            if (partnerId) {
              const { data: partnerProfile } = await supabase
                .from("profiles")
                .select("first_name")
                .eq("id", partnerId)
                .maybeSingle();

              if (partnerProfile?.first_name) {
                senderName = `${safeName(senderProfile.first_name)} & ${safeName(partnerProfile.first_name, "Partner")}`;
              } else {
                senderName = safeName(senderProfile.first_name, "A member");
              }
            } else {
              senderName = safeName(senderProfile.first_name, "A member");
            }
          } else {
            senderName = safeName(senderProfile.first_name, "A member");
          }
        } else {
          senderName = safeName(senderProfile.first_name, "A member");
        }
      }
    }

    const recipientDisplayName = safeName(recipientProfile.first_name, "there");
    const parsedScore = typeof score === "number" && score > 0 ? Math.round(score) : null;
    const baseUrl = (app_url || Deno.env.get("APP_URL") || "https://duogo2.vercel.app").replace(/\/+$/, "");
    const loginUrl = `${baseUrl}/matches?tab=received`;

    const emailSubject = `✨ ${senderName} sent you a connection request on duogo!`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(emailSubject)}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1A1816;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF7F2; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 28px; border: 1px solid #EFE8DD; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
                
                <!-- Header Banner -->
                <tr>
                  <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #FFF5F0 0%, #FFFFFF 100%); border-bottom: 1px solid #F5EDE3;">
                    <div style="display: inline-block; padding: 6px 14px; background-color: #FFF0EB; border-radius: 999px; margin-bottom: 16px;">
                      <span style="font-size: 13px; font-weight: 700; color: #FF5436; text-transform: uppercase; letter-spacing: 0.8px;">✨ Connection Request</span>
                    </div>
                    <h1 style="font-size: 26px; font-weight: 800; color: #1A1816; margin: 0 0 8px 0; letter-spacing: -0.5px;">
                      Someone wants to connect with you!
                    </h1>
                    ${
                      parsedScore
                        ? `<p style="margin: 0; font-size: 15px; font-weight: 600; color: #FF5436;">
                            🎯 ${parsedScore}% Authentic Synergy Match
                           </p>`
                        : ""
                    }
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <p style="font-size: 16px; line-height: 1.6; color: #1A1816; margin: 0 0 16px 0;">
                      Hi <strong>${escapeHtml(recipientDisplayName)}</strong>,
                    </p>
                    <p style="font-size: 16px; line-height: 1.6; color: #4A443D; margin: 0 0 20px 0;">
                      <strong>${escapeHtml(senderName)}</strong> ${senderLocation ? `in <em>${escapeHtml(senderLocation)}</em> ` : ""}reviewed your profile and sent you a connection request on duogo.
                    </p>

                    <!-- Feature Box -->
                    <div style="background-color: #FAF7F2; border: 1px solid #EFE8DD; border-radius: 18px; padding: 20px; margin: 24px 0; text-align: center;">
                      <p style="font-size: 15px; font-weight: 600; color: #1A1816; margin: 0 0 6px 0;">
                        Ready to see your compatibility match?
                      </p>
                      <p style="font-size: 14px; color: #706A62; margin: 0; line-height: 1.5;">
                        Log into the app to view their 10-dimension lifestyle comparison, see shared traits, and connect back to start chatting.
                      </p>
                    </div>

                    <!-- Call to Action Button -->
                    <div style="text-align: center; margin: 32px 0 20px 0;">
                      <a href="${escapeHtml(loginUrl)}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #FF7A59 0%, #FF5436 100%); color: #FFFFFF; font-size: 16px; font-weight: 700; text-decoration: none; padding: 15px 32px; border-radius: 999px; box-shadow: 0 4px 12px rgba(255, 84, 54, 0.3); letter-spacing: 0.2px;">
                        Log in to Check Connection Request &rarr;
                      </a>
                    </div>

                    <p style="font-size: 13px; color: #8C847B; text-align: center; margin: 24px 0 0 0;">
                      If you're already logged in, tapping the button will take you directly to your received requests tab.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #FAF7F2; border-top: 1px solid #EFE8DD; text-align: center;">
                    <p style="font-size: 13px; font-weight: 600; color: #1A1816; margin: 0 0 4px 0;">
                      duogo · friendship, matched properly
                    </p>
                    <p style="font-size: 12px; color: #8C847B; margin: 0;">
                      You received this email because you have an active account on duogo.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SENDER_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "hello@duogo.app";
    const SENDER_NAME = Deno.env.get("BREVO_FROM_NAME") || "duogo";

    let emailSent = false;
    let provider = "none";
    let emailResult: any = null;

    // 1. Try Brevo API if key is present
    if (BREVO_API_KEY) {
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: recipientProfile.email, name: recipientDisplayName }],
            subject: emailSubject,
            htmlContent: emailHtml,
          }),
        });

        if (brevoRes.ok) {
          emailResult = await brevoRes.json();
          emailSent = true;
          provider = "brevo";
        } else {
          console.warn("Brevo API error:", await brevoRes.text());
        }
      } catch (brevoErr) {
        console.error("Failed to send via Brevo:", brevoErr);
      }
    }

    // 2. Try Resend API if key is present and not sent yet
    if (!emailSent && RESEND_API_KEY) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            to: [recipientProfile.email],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailResult = await resendRes.json();
          emailSent = true;
          provider = "resend";
        } else {
          console.warn("Resend API error:", await resendRes.text());
        }
      } catch (resendErr) {
        console.error("Failed to send via Resend:", resendErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        provider,
        recipient: recipientProfile.email,
        details: emailResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Connection request email handler error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

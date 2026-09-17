import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

app.use(express.json());

// Configure Web Push VAPID
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BFenrfWblKrdVKBkKrxLgsEVJ51So2YQ4GomdjpusNrHKj3E5AVKWEKjnKXiR2cxzvdOQ49q7Qth8DfBPt0Ec7o";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "EthUTKhFS6weuz64Xc-zUrHXrGVk1_AUkzwdtRvySis";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@duogo.space";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.warn("Failed to configure WebPush VAPID:", vapidErr);
}

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * Endpoint 1: Match Synergy Summary ("Why You Two Click")
 * Generates an intelligent, personalized breakdown of compatibility
 */
app.post("/api/ai/synergy", async (req, res) => {
  try {
    const {
      userName = "You",
      matchName = "Your match",
      sharedVibes = [],
      city = "",
      score = 85,
      dimensionDetails = [],
    } = req.body;

    const ai = getAIClient();

    if (ai) {
      const prompt = `You are the lead friendship compatibility expert at 'duogo', an intentional adult friendship app.
Analyze the mutual compatibility between two people based purely on their quiz responses and lifestyle traits:
- User 1: You
- User 2: Candidate Match
- Compatibility Match Score: ${score}%
${city ? `- Location: ${city}` : ""}
${sharedVibes.length > 0 ? `- Top Shared Lifestyle Vibes: ${sharedVibes.join(", ")}` : ""}
${dimensionDetails.length > 0 ? `- Shared Traits / Dimensions: ${dimensionDetails.join(", ")}` : ""}

CRITICAL RULES:
- STRICT ZERO-BIAS & GENDER-NEUTRAL: Never use names, gender, or gendered pronouns (no he/she/his/her). Always use gender-neutral phrasing (e.g., "you and your match", "both of you").
- Focus 100% on shared lifestyle pacing, social battery, gathering preferences, and weekend rhythms from their quiz responses.

Generate an insightful, uplifting, and realistic "Why You Two Click" breakdown:
1. 'headline': A punchy 3 to 6 word theme summarizing their shared vibe (e.g. "Weekend Explorers & Deep Thinkers").
2. 'summary': 2 warm, natural sentences explaining why their lifestyles and energy complement each other so well without mentioning names or genders.
3. 'sharedStrengths': An array of 3 distinct, specific synergies (e.g. "Both favor relaxed coffee spots over high-volume venues", "Balanced blend of intellectual banter and outdoor curiosity").
4. 'recommendedActivity': A specific, low-pressure first hangout idea tailored to their common interests.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                summary: { type: Type.STRING },
                sharedStrengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedActivity: { type: Type.STRING },
              },
              required: ["headline", "summary", "sharedStrengths", "recommendedActivity"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, source: "gemini", data: parsed });
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed, falling back to algorithmic synthesis:", geminiErr);
      }
    }

    // Algorithmic Fallback if Gemini key is missing or call encounters limit
    const fallbackVibes = sharedVibes.length > 0 ? sharedVibes : ["Social Rhythm", "Weekend Pacing", "Shared Interests"];
    const topVibe = fallbackVibes[0] || "Lifestyle Alignment";
    const secondVibe = fallbackVibes[1] || "Social Battery";
    const cleanCity = city ? city.split("·")[0].split("•")[0].trim() : "";

    return res.json({
      success: true,
      source: "algorithmic_fallback",
      data: {
        headline: `${topVibe} & ${secondVibe}`,
        summary: `Your quiz results show a strong ${score}% synergy. You both share a synchronized social pace and complementary routines for low-pressure get-togethers.`,
        sharedStrengths: [
          `Compatible tempo for ${topVibe.toLowerCase()}`,
          `Complementary social energy for relaxed hangouts`,
          `Similar balance between active socializing and quiet downtime`,
        ],
        recommendedActivity: cleanCity
          ? `Casual coffee or neighborhood stroll in ${cleanCity}`
          : "Grab a coffee or tea and take a relaxed neighborhood walk",
      },
    });
  } catch (error) {
    console.error("Error generating synergy summary:", error);
    res.status(500).json({ error: "Failed to generate synergy breakdown" });
  }
});

/**
 * Endpoint 2: AI Conversation Starters
 * Generates personalized, engaging icebreakers to kickstart in-app chat
 */
app.post("/api/ai/icebreakers", async (req, res) => {
  try {
    const {
      userName = "User",
      matchName = "Friend",
      sharedVibes = [],
      city = "",
      userType = "solo",
    } = req.body;

    const ai = getAIClient();

    if (ai) {
      const prompt = `You are a social conversational coach for 'duogo', an intentional adult friendship platform.
Create 4 natural, engaging, and friendly conversation starters for ${userName} to send to their new match ${matchName}.
${city ? `- City/Region: ${city}` : ""}
${userType === "couple" ? "- Note: One or both parties are a couple seeking couple/double-date friendships." : ""}
${sharedVibes.length > 0 ? `- Shared Vibes / Interests: ${sharedVibes.join(", ")}` : ""}

Rules for the icebreakers:
- Keep them casual, witty, and relatable — NO cheesy pickup lines, NO awkward interview questions.
- Reference their shared vibe or common activities naturally.
- Keep each starter to 1-2 punchy sentences that make it effortless to reply.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                icebreakers: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["icebreakers"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, source: "gemini", icebreakers: parsed.icebreakers || [] });
        }
      } catch (geminiErr) {
        console.warn("Gemini icebreaker generation failed, falling back:", geminiErr);
      }
    }

    // High quality fallback icebreakers
    const fallbackStarters = [
      `Hey ${matchName}! Looks like our vibes matched on ${sharedVibes[0] || "lifestyle habits"}. What's your go-to weekend spot around here?`,
      `Hi ${matchName}! Love that we're both into ${sharedVibes[1] || "good food and relaxed hangouts"}. Any recent cafe or hidden gem you'd recommend?`,
      `Hey! Excited we matched. Quick question: are you more of an early morning coffee person or a late evening chill person?`,
      `Hey ${matchName}, great to connect! What's currently the highlight of your week?`,
    ];

    return res.json({
      success: true,
      source: "algorithmic_fallback",
      icebreakers: fallbackStarters,
    });
  } catch (error) {
    console.error("Error generating icebreakers:", error);
    res.status(500).json({ error: "Failed to generate conversation starters" });
  }
});

/**
 * Endpoint 3: Web Push Dispatcher
 * Sends encrypted push notifications to a device subscription or all subscriptions for a userId
 */
app.post("/api/push/dispatch", async (req, res) => {
  try {
    const { subscription, userId, user_id, title, body, url, type = "general", tag } = req.body;
    const targetUserId = userId || user_id;

    if (!title) {
      return res.status(400).json({ error: "Missing required notification title" });
    }

    if (!subscription && !targetUserId) {
      return res.status(400).json({ error: "Must provide either subscription object or userId/user_id" });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/notifications",
      type,
      tag: tag || `duogo-push-${Date.now()}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      timestamp: Date.now(),
    });

    let sentCount = 0;

    // 1. Direct subscription object dispatch
    if (subscription?.endpoint && subscription?.keys) {
      try {
        await webpush.sendNotification(subscription, payload);
        sentCount++;
      } catch (subErr: any) {
        console.warn("Direct subscription send error:", subErr?.message);
      }
    }

    // 2. Dispatch to all active subscriptions of target user
    if (targetUserId) {
      try {
        const supabaseUrl =
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          "https://hdbobqzqsmmsnzbjtzbn.supabase.co";
        const supabaseKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k";

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: subs, error } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", targetUserId);

        if (!error && subs && subs.length > 0) {
          for (const sub of subs) {
            if (sub.endpoint && sub.p256dh && sub.auth) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth,
                    },
                  },
                  payload
                );
                sentCount++;
              } catch (pushErr: any) {
                console.warn(`Error sending push to endpoint for user ${targetUserId}:`, pushErr?.message);
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn("Error querying push subscriptions for user:", targetUserId, dbErr);
      }
    }

    return res.json({
      success: true,
      sentCount,
      message: `Push notification dispatched (sent to ${sentCount} endpoint${sentCount === 1 ? "" : "s"})`,
    });
  } catch (err: any) {
    console.error("Push notification dispatch error:", err);
    return res.status(err.statusCode || 500).json({
      error: err.message || "Failed to dispatch push notification",
      statusCode: err.statusCode,
    });
  }
});

/**
 * Endpoint 4: Immediate Connection Request Email Dispatcher
 * Dispatches an email notification alerting the user of an incoming connection request
 */
app.post("/api/email/connection-request", async (req, res) => {
  try {
    const { sender_id, recipient_id, score, app_url } = req.body;

    if (!recipient_id) {
      return res.status(400).json({ error: "Missing required recipient_id" });
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://hdbobqzqsmmsnzbjtzbn.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch recipient profile
    const { data: recipientProfile, error: recipientErr } = await supabase
      .from("profiles")
      .select("id, first_name, email, is_suspended")
      .eq("id", recipient_id)
      .single();

    if (recipientErr || !recipientProfile?.email) {
      return res.status(404).json({ error: "Recipient email not found" });
    }

    if (recipientProfile.is_suspended) {
      return res.json({ success: true, skipped: true, reason: "Account suspended" });
    }

    // 2. Fetch sender profile
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
        senderName = senderProfile.first_name?.trim() || "A member";
      }
    }

    const recipientName = recipientProfile.first_name?.trim() || "Friend";
    const parsedScore = typeof score === "number" && score > 0 ? Math.round(score) : null;
    const baseUrl = (app_url || process.env.APP_URL || "https://duogo2.vercel.app").replace(/\/+$/, "");
    const loginUrl = `${baseUrl}/matches?tab=received`;

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SENDER_EMAIL = process.env.BREVO_FROM_EMAIL || "hello@duogo.app";
    const SENDER_NAME = process.env.BREVO_FROM_NAME || "duogo";

    const emailSubject = `✨ ${senderName} sent you a connection request on duogo!`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:32px 16px;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1816;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;border:1px solid #EFE8DD;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px;text-align:center;background:linear-gradient(180deg,#FFF5F0 0%,#fff 100%);border-bottom:1px solid #F5EDE3;">
              <span style="font-size:12px;font-weight:700;color:#FF5436;background:#FFF0EB;padding:5px 12px;border-radius:999px;text-transform:uppercase;">✨ Connection Request</span>
              <h1 style="font-size:24px;font-weight:800;color:#1A1816;margin:14px 0 6px 0;">Someone wants to connect with you!</h1>
              ${parsedScore ? `<p style="margin:0;font-size:15px;font-weight:700;color:#FF5436;">🎯 ${parsedScore}% Authentic Synergy Match</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              <p style="font-size:16px;color:#1A1816;margin:0 0 14px 0;">Hi <strong>${recipientName}</strong>,</p>
              <p style="font-size:15px;line-height:1.6;color:#4A443D;margin:0 0 20px 0;">
                <strong>${senderName}</strong> ${senderLocation ? `in ${senderLocation} ` : ""}reviewed your profile and sent you a connection request on duogo.
              </p>
              <div style="background:#FAF7F2;border:1px solid #EFE8DD;border-radius:16px;padding:18px;margin:20px 0;text-align:center;">
                <p style="font-size:14px;font-weight:600;color:#1A1816;margin:0 0 4px 0;">Log into duogo to review their connection request</p>
                <p style="font-size:13px;color:#706A62;margin:0;">See your shared lifestyle dimensions, common vibe traits, and connect back to start chatting.</p>
              </div>
              <div style="text-align:center;margin:28px 0 16px 0;">
                <a href="${loginUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF7A59 0%,#FF5436 100%);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;box-shadow:0 4px 12px rgba(255,84,54,0.3);">
                  Log in to View Connection Request &rarr;
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#FAF7F2;border-top:1px solid #EFE8DD;text-align:center;font-size:12px;color:#8C847B;">
              duogo · friendship, matched properly
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (BREVO_API_KEY) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: SENDER_EMAIL },
          to: [{ email: recipientProfile.email, name: recipientName }],
          subject: emailSubject,
          htmlContent: emailHtml,
        }),
      }).catch(console.warn);
    } else if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
          to: [recipientProfile.email],
          subject: emailSubject,
          html: emailHtml,
        }),
      }).catch(console.warn);
    }

    return res.json({ success: true, recipient: recipientProfile.email });
  } catch (err: any) {
    console.error("Connection request email error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Duogo server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

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
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@duogo.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (vapidErr) {
    console.warn("Failed to configure WebPush VAPID:", vapidErr);
  }
}

// Supabase client setup with safe fallback defaults
const DEFAULT_SUPABASE_URL = "https://hdbobqzqsmmsnzbjtzbn.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

const supabase = getSupabaseAdmin();

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count };
}

// Authentication middleware requiring a valid Supabase Bearer token
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required. Please provide a valid Bearer token." });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session token." });
    }

    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication check failed." });
  }
}

// Rate Limiter middleware for AI endpoints (10 requests per user per minute)
function aiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = (req as any).user?.id || req.ip || "unknown";
  const { allowed, remaining } = checkRateLimit(`ai:${userId}`, 10, 60000);

  res.setHeader("X-RateLimit-Limit", "10");
  res.setHeader("X-RateLimit-Remaining", remaining.toString());

  if (!allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded. Please wait a minute before making more AI requests.",
    });
  }

  next();
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
app.post("/api/ai/synergy", requireAuth, aiRateLimiter, async (req, res) => {
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
app.post("/api/ai/icebreakers", requireAuth, aiRateLimiter, async (req, res) => {
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

    // Authenticate request token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
    }

    const supabase = getSupabaseAdmin();

    // Verify caller user JWT
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    // Authorize caller for targetUserId
    if (targetUserId && callerUser.id !== targetUserId) {
      const [{ data: matchRecord }, { data: coupleRecord }] = await Promise.all([
        supabase
          .from("matches")
          .select("id")
          .or(
            `and(user_a_id.eq.${callerUser.id},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${callerUser.id})`
          )
          .maybeSingle(),
        supabase
          .from("couples")
          .select("id")
          .or(
            `and(partner_a_id.eq.${callerUser.id},partner_b_id.eq.${targetUserId}),and(partner_a_id.eq.${targetUserId},partner_b_id.eq.${callerUser.id})`
          )
          .maybeSingle(),
      ]);

      if (!matchRecord && !coupleRecord) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to send push notifications to this user" });
      }
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
        const supabase = getSupabaseAdmin();
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
 * Endpoint 4: Connection Request Email Dispatcher
 * Sends an email notification to target user when someone sends a connection request
 */
app.post("/api/email/request-notification", async (req, res) => {
  try {
    const { targetUserId, senderUserId, senderName: inputSenderName } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId is required" });
    }

    const supabase = getSupabaseAdmin();

    // Get recipient profile
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!recipientProfile?.email) {
      return res.json({ success: false, reason: "Recipient email not found" });
    }

    let senderName = inputSenderName || "Someone";
    if (senderUserId && !inputSenderName) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", senderUserId)
        .maybeSingle();
      if (senderProfile?.first_name) {
        senderName = senderProfile.first_name;
      }
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_FROM_EMAIL || "hello@duogo.app";
    const senderTitle = process.env.BREVO_FROM_NAME || "duogo";
    const appUrl = process.env.APP_URL || "https://ais-pre-6yzpxzlgcwbilgl7xpgtyq-233276762244.us-east1.run.app";

    if (!brevoApiKey) {
      console.log(`[Email Dispatch] BREVO_API_KEY not configured. Email notification skipped for ${recipientProfile.email}`);
      return res.json({
        success: true,
        emailSent: false,
        reason: "BREVO_API_KEY environment variable is not configured",
        recipient: recipientProfile.email,
      });
    }

    const recipientName = recipientProfile.first_name || "Friend";
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff;">
        <h1 style="color: #e84a2b; text-align: center; font-size: 26px; margin-bottom: 8px;">✨ New Connection Request!</h1>
        <p style="font-size: 16px; color: #333;">Hi ${recipientName},</p>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          <strong>${senderName}</strong> reviewed your profile on duogo and sent you a connection request!
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}/matches?tab=received" style="display: inline-block; background-color: #e84a2b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Review Connection Request
          </a>
        </div>
        <p style="font-size: 14px; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          duogo · Find your people.
        </p>
      </div>
    `;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderTitle, email: senderEmail },
        to: [{ email: recipientProfile.email }],
        subject: `✨ ${senderName} sent you a connection request on duogo!`,
        htmlContent,
      }),
    });

    const emailSent = brevoRes.ok;
    return res.json({
      success: true,
      emailSent,
      recipient: recipientProfile.email,
    });
  } catch (err: any) {
    console.error("Email request notification error:", err);
    return res.status(500).json({ error: err.message || "Failed to send request email" });
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

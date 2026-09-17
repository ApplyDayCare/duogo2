import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

app.use(express.json());

// Anti-caching middleware for dev and preview to ensure browsers always load fresh code
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html") || req.path === "/sw.js" || req.path.startsWith("/src/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

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

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

/**
 * Endpoint 1: Web Push Dispatcher
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
    const appUrl = process.env.APP_URL || (req.get("host") ? `${req.protocol}://${req.get("host")}` : "https://duogo.app");

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

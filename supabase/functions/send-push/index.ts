// Supabase Edge Function: send-push
// Dispatches encrypted Web Push notifications to user devices via VAPID
// Deploy with: supabase functions deploy send-push --no-verify-jwt

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "https://esm.sh/web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@duogo.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const bodyJson = await req.json();
    const targetUserId = bodyJson.userId || bodyJson.user_id;
    const { title, body, url, type, tag, matchId } = bodyJson;

    if (!targetUserId || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields: userId/user_id, title" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Authenticate caller using JWT
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Authorize caller for targetUserId
    // Caller can send to self, or to matched/partner user
    if (callerUser.id !== targetUserId) {
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
        return new Response(
          JSON.stringify({ error: "Forbidden: You are not authorized to send push notifications to this user" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Fetch all active device push subscriptions for target user
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", targetUserId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active push subscriptions found for user", sentCount: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/notifications",
      type: type || "general",
      tag: tag || `duogo-${Date.now()}`,
      matchId: matchId || undefined,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });

    const sendResults = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { success: true, endpoint: sub.endpoint };
        } catch (err: any) {
          // If subscription is expired/unsubscribed (404 or 410 Gone), prune it from database
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
          throw err;
        }
      })
    );

    const successful = sendResults.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successful,
        totalSubscriptions: subscriptions.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

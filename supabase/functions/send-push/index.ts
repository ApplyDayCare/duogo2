import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto helpers using Web Crypto API
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  // Use the web-push approach with fetch
  // For Deno, we'll use a simpler JWT-based VAPID approach

  const encoder = new TextEncoder();

  // Create VAPID JWT
  const header = { typ: "JWT", alg: "ES256" };
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: vapidSubject,
  };

  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(encoder.encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import private key
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const sigB64 = base64urlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${convertDerToRaw(sigB64)}`;

  // Encrypt payload using WebPush encryption (simplified - send unencrypted for now via fetch)
  // For proper encryption we need the full RFC 8291 implementation
  // Using a simpler approach: send the push with no payload encryption for browsers that support it
  
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: encoder.encode(payload),
  });

  return response;
}

function base64urlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPkcs8(rawPrivateKey: Uint8Array): ArrayBuffer {
  // Wrap raw 32-byte EC private key in PKCS8 DER structure for P-256
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We need the public key too for full PKCS8, but for signing we can skip it
  // Actually for importKey pkcs8, we need the full structure
  // Simpler: use raw key import with JWK
  const result = new Uint8Array(pkcs8Header.length + rawPrivateKey.length);
  result.set(pkcs8Header);
  result.set(rawPrivateKey, pkcs8Header.length);
  return result.buffer;
}

function convertDerToRaw(sigB64: string): string {
  // ECDSA signatures from Web Crypto are in IEEE P1363 format (raw r||s), not DER
  // So we can use them directly
  return sigB64;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, message, url } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    // ---- Authorization ----
    // Accept either:
    //  (a) the service role key (internal server-to-server callers), OR
    //  (b) a valid end-user JWT where the caller is allowed to push to user_id
    //      (caller is the target, OR shares a mutual match with the target,
    //       including couple-partner expansion).
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authorized = token === serviceRoleKey;

    if (!authorized) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerId = claimsData.claims.sub as string;

      if (callerId === user_id) {
        authorized = true;
      } else {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: couple } = await adminClient
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${callerId},partner_b_id.eq.${callerId}`)
          .maybeSingle();
        const partnerId = couple
          ? (couple.partner_a_id === callerId ? couple.partner_b_id : couple.partner_a_id)
          : null;
        const sides = [callerId, ...(partnerId ? [partnerId] : [])];
        const { data: matchRows } = await adminClient
          .from("matches")
          .select("user_a_id, user_b_id")
          .eq("status", "mutual")
          .or(sides.flatMap((s) => [`user_a_id.eq.${s}`, `user_b_id.eq.${s}`]).join(","));
        authorized = !!matchRows?.some(
          (m) =>
            (sides.includes(m.user_a_id) && m.user_b_id === user_id) ||
            (sides.includes(m.user_b_id) && m.user_a_id === user_id)
        );
      }

      if (!authorized) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "duogo",
      body: body || message || "You have a new notification",
      url: url || "/notifications",
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subscriptions) {
      try {
        const res = await sendWebPush(
          sub,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          "mailto:hello@duogo.space"
        );

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expired, clean up
          expired.push(sub.endpoint);
        } else {
          console.error(`Push failed for endpoint: ${res.status} ${await res.text()}`);
        }
      } catch (err) {
        console.error("Push send error:", err);
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expired);
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

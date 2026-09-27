import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  hasVapidKey: boolean;
  requestPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  resetAndReconnectPush: () => Promise<boolean>;
  dispatchBackgroundNotification: (title: string, options?: NotificationOptions & { url?: string; type?: string }) => void;
  unsubscribeFromPush: () => Promise<boolean>;
}

export const DEFAULT_VAPID_PUBLIC_KEY = "BM2wzi9DNHlsYCm45Gn6JC6CAvoYW4HiEYj_-DWz3NqWD3Tybm4Qr82cI4taetONkD-oXaMiA_c_nNiRB2ZTXS4";

let cachedVapidPublicKey: string | null = null;

function isValidDecodedVapidKey(key: string): boolean {
  if (!key || typeof key !== "string" || key.startsWith("sb_") || key.length < 50) return false;
  try {
    const bytes = urlBase64ToUint8Array(key);
    return bytes.length === 65;
  } catch {
    return false;
  }
}

export async function getEffectiveVapidPublicKey(forceFresh = false): Promise<string> {
  if (!forceFresh && cachedVapidPublicKey && isValidDecodedVapidKey(cachedVapidPublicKey)) {
    return cachedVapidPublicKey;
  }

  // 1. Fetch dynamically from Supabase send-push GET endpoint
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    if (supabaseUrl) {
      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/send-push?t=${Date.now()}`, {
        method: "GET",
        headers: anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {},
      });
      if (edgeRes.ok) {
        const data = await edgeRes.json();
        if (data?.publicKey && isValidDecodedVapidKey(data.publicKey.trim())) {
          cachedVapidPublicKey = data.publicKey.trim();
          console.log("[PWA Push] Successfully fetched active VAPID key from Edge Function:", cachedVapidPublicKey);
          return cachedVapidPublicKey;
        }
      }
    }
  } catch (err) {
    console.warn("[PWA Push] Failed to fetch dynamic VAPID key from Edge Function:", err);
  }

  // 2. Check if explicitly passed via valid env var
  const envKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
  if (envKey && isValidDecodedVapidKey(envKey) && !envKey.startsWith("sb_")) {
    cachedVapidPublicKey = envKey;
    return envKey;
  }

  // 3. Fallback to constant
  cachedVapidPublicKey = DEFAULT_VAPID_PUBLIC_KEY;
  return DEFAULT_VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function usePushNotifications(): PushNotificationState {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [hasVapidKey, setHasVapidKey] = useState<boolean>(true);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    getEffectiveVapidPublicKey().then((k) => setHasVapidKey(Boolean(k && k.length > 0)));
  }, []);

  // Sync PushSubscription to Supabase
  const saveSubscriptionToSupabase = useCallback(async (subscription: PushSubscription, userId: string) => {
    try {
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;

      if (!subscription.endpoint || !p256dh || !auth) {
        console.warn("[PWA Push] Missing endpoint/keys in subscription payload:", subJson);
        return;
      }

      console.log(`[PWA Push] Syncing subscription for user ${userId} to Supabase...`, {
        endpoint: subscription.endpoint.slice(0, 45) + "...",
      });

      // 1. Direct Supabase Client Upsert / Insert
      try {
        const { data: existing } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("push_subscriptions")
            .update({
              user_id: userId,
              p256dh,
              auth,
            })
            .eq("id", existing.id);
          console.log("[PWA Push] Successfully updated existing push subscription row in Supabase.");
        } else {
          const { error: insertErr } = await supabase
            .from("push_subscriptions")
            .insert({
              user_id: userId,
              endpoint: subscription.endpoint,
              p256dh,
              auth,
            });
          if (insertErr) {
            console.warn("[PWA Push] Direct insert error (will fallback to proxy):", insertErr.message);
          } else {
            console.log("[PWA Push] Successfully inserted new push subscription row into Supabase.");
          }
        }
      } catch (clientErr) {
        console.warn("[PWA Push] Client Supabase sync error:", clientErr);
      }

      // 2. Server-side proxy sync as backup with service_role access
      try {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            subscription: subJson,
          }),
        });
      } catch (proxyErr) {
        console.warn("[PWA Push] Proxy push/subscribe sync:", proxyErr);
      }
    } catch (err) {
      console.warn("[PWA Push] Failed to sync subscription:", err);
    }
  }, []);

  // Register push subscription via PushManager
  const registerPushSubscription = useCallback(
    async (reg: ServiceWorkerRegistration, userId?: string, forceRenew = false): Promise<PushSubscription | null> => {
      try {
        if (!("pushManager" in reg)) return null;

        const effectiveKey = await getEffectiveVapidPublicKey();
        if (!effectiveKey) {
          console.warn("[PWA Push] No VAPID public key available to subscribe.");
          return null;
        }

        const applicationServerKey = urlBase64ToUint8Array(effectiveKey);
        let sub = await reg.pushManager.getSubscription();

        if (forceRenew && sub) {
          console.log("[PWA Push] Force renewing push subscription...");
          try {
            await sub.unsubscribe();
          } catch {}
          sub = null;
        }

        // If a subscription already exists, verify its applicationServerKey matches the current active server VAPID key
        if (sub && sub.options && sub.options.applicationServerKey) {
          const existingKeyRaw = new Uint8Array(sub.options.applicationServerKey);
          const existingKeyB64 = uint8ArrayToBase64Url(existingKeyRaw);
          const keysMatch =
            existingKeyRaw.length === applicationServerKey.length &&
            existingKeyRaw.every((val, i) => val === applicationServerKey[i]);

          if (!keysMatch) {
            console.warn(
              `[PWA Push] ⚠️ Key Mismatch! Subscription key: ${existingKeyB64.slice(0, 15)}... does NOT match active server key: ${effectiveKey.slice(0, 15)}... Refreshing subscription...`
            );
            try {
              await sub.unsubscribe();
            } catch {
              // ignore
            }
            sub = null;
          } else {
            console.log(`[PWA Push] ✅ Subscription key matches active server key (${effectiveKey.slice(0, 15)}...)`);
          }
        }

        // If subscription doesn't exist (or was refreshed), create it with current VAPID key
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          });
        }

        if (sub) {
          setIsSubscribed(true);
          if (userId) {
            await saveSubscriptionToSupabase(sub, userId);
          }
        }
        return sub;
      } catch (err) {
        console.warn("[PWA Push] pushManager.subscribe error:", err);
        return null;
      }
    },
    [saveSubscriptionToSupabase]
  );

  // Initialize service worker & check permissions
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then(async (reg) => {
          swRegRef.current = reg;
          if (Notification.permission === "granted") {
            setIsSubscribed(true);
            if (user?.id) {
              await registerPushSubscription(reg, user.id);
            }
          }
        })
        .catch(() => {
          navigator.serviceWorker
            .register("/sw.js")
            .then(async (reg) => {
              swRegRef.current = reg;
              if (Notification.permission === "granted") {
                setIsSubscribed(true);
                if (user?.id) {
                  await registerPushSubscription(reg, user.id);
                }
              }
            })
            .catch((err) => {
              console.warn("[PWA] Service Worker registration failed:", err);
            });
        });

      // Listen for PUSH_SUBSCRIPTION_CHANGED from Service Worker
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED" && user?.id) {
          if (swRegRef.current) {
            registerPushSubscription(swRegRef.current, user.id, true);
          }
        }
      };
      navigator.serviceWorker.addEventListener("message", handleSwMessage);

      return () => {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      };
    }
  }, [user?.id, registerPushSubscription]);

  // Request notification permission from user
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: "Notifications Not Supported",
        description: "Your browser does not support Web Push notifications.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        setIsSubscribed(true);
        if (swRegRef.current) {
          await registerPushSubscription(swRegRef.current, user?.id);
        }
        toast({
          title: "🔔 Push Notifications Enabled",
          description: "You'll be notified when couples send messages or match requests!",
        });
        return true;
      } else if (result === "denied") {
        toast({
          title: "Notifications Blocked",
          description: "Please allow notifications in your browser settings to receive alerts.",
          variant: "destructive",
        });
        return false;
      }
      return false;
    } catch (err) {
      console.error("[PWA] Error requesting permission:", err);
      return false;
    }
  }, [isSupported, user?.id, registerPushSubscription, toast]);

  // Unsubscribe from Push
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    try {
      if (swRegRef.current && "pushManager" in swRegRef.current) {
        const sub = await swRegRef.current.pushManager.getSubscription();
        if (sub) {
          if (user?.id) {
            await supabase
              .from("push_subscriptions" as any)
              .delete()
              .eq("endpoint", sub.endpoint)
              .eq("user_id", user.id);
          }
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
      toast({
        title: "Notifications Disabled",
        description: "You have unsubscribed from push notifications.",
      });
      return true;
    } catch (err) {
      console.warn("[PWA Push] Unsubscribe failed:", err);
      return false;
    }
  }, [user?.id, toast]);

  // Reset and reconnect push device subscription with full kill-switch
  const resetAndReconnectPush = useCallback(async (): Promise<{
    success: boolean;
    serverKey: string;
    clientKey: string;
    keysMatch: boolean;
    endpoint?: string;
    error?: string;
  }> => {
    try {
      cachedVapidPublicKey = null;
      console.log("==================================================");
      console.log("[PWA Push] INITIATING FULL KILL SWITCH & HARD RESET");

      // 1. Fetch the exact active public key directly from the backend Edge Function
      const activeKey = await getEffectiveVapidPublicKey(true);
      console.log("CRITICAL DEBUG: Active Server VAPID Public Key:", activeKey);
      if (!activeKey) {
        throw new Error("Error fetching server key: No public key returned from Edge Function.");
      }

      // 2. Unregister ALL old service workers
      if ("serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            console.log("[PWA Push Kill-Switch] Unregistering service worker:", reg);
            await reg.unregister();
          }
        } catch (swUnregErr) {
          console.warn("[PWA Push] Warning unregistering old service workers:", swUnregErr);
        }
      }

      // 3. Clear ALL browser caches
      if ("caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          for (const k of cacheKeys) {
            console.log("[PWA Push Kill-Switch] Deleting cache:", k);
            await caches.delete(k);
          }
        } catch (cacheErr) {
          console.warn("[PWA Push] Warning clearing caches:", cacheErr);
        }
      }

      // 4. Clear database push_subscriptions for this user
      if (user?.id) {
        try {
          await supabase.from("push_subscriptions" as any).delete().eq("user_id", user.id);
          console.log("[PWA Push] Cleared old DB push_subscriptions for user:", user.id);
        } catch (dbErr) {
          console.warn("[PWA Push] DB clear warning:", dbErr);
        }
      }

      // 5. Register a fresh Service Worker with timestamp query
      const freshReg = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`);
      swRegRef.current = freshReg;
      
      // Wait for service worker to be active
      let readyReg = await navigator.serviceWorker.ready;
      
      // Ensure the worker is active
      if (!readyReg.active) {
        const worker = readyReg.installing || readyReg.waiting || freshReg.installing || freshReg.waiting;
        if (worker) {
          await new Promise<void>((resolve) => {
            worker.addEventListener("statechange", () => {
              if (worker.state === "activated") resolve();
            });
            setTimeout(resolve, 2000);
          });
        }
        readyReg = await navigator.serviceWorker.ready;
      }
      
      console.log("[PWA Push] Fresh Service Worker fully active & ready.");

      // 6. Request / Ensure browser permission
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      // 7. Clear any existing subscription on this registration before subscribing
      try {
        const existingSub = await readyReg.pushManager.getSubscription();
        if (existingSub) {
          console.log("[PWA Push] Unsubscribing previous subscription during resync...");
          await existingSub.unsubscribe();
        }
      } catch (unsubErr) {
        console.warn("[PWA Push] Non-fatal error cleaning up existing subscription:", unsubErr);
      }

      // 8. Subscribe with the active VAPID key
      const applicationServerKey = urlBase64ToUint8Array(activeKey);
      const newSub = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      console.log("[PWA Push] New subscription endpoint:", newSub.endpoint);

      // 9. Decode the exact key stored in the browser subscription
      const clientKeyRaw = new Uint8Array(newSub.options.applicationServerKey || []);
      const decodedClientKey = uint8ArrayToBase64Url(clientKeyRaw);
      const keysMatch =
        clientKeyRaw.length === applicationServerKey.length &&
        clientKeyRaw.every((val, i) => val === applicationServerKey[i]);

      console.log("CRITICAL DEBUG: Exact Key Verification", {
        serverKey: activeKey,
        decodedClientKey,
        keysMatch,
      });

      // 10. Save fresh subscription to Supabase
      if (user?.id) {
        await saveSubscriptionToSupabase(newSub, user.id);
      }

      setIsSubscribed(true);
      setPermission("granted");
      console.log("==================================================");

      toast({
        title: "✅ Push Device 100% Synced",
        description: "Old workers & caches purged. Device linked to active server key.",
      });

      return {
        success: true,
        serverKey: activeKey,
        clientKey: decodedClientKey || activeKey,
        keysMatch,
        endpoint: newSub.endpoint,
      };
    } catch (err: any) {
      console.error("[PWA Push] Reset error:", err);
      toast({
        title: "Re-link Failed",
        description: err.message || "Failed to reset push subscription",
        variant: "destructive",
      });
      return {
        success: false,
        serverKey: DEFAULT_VAPID_PUBLIC_KEY,
        clientKey: "error",
        keysMatch: false,
        error: err.message,
      };
    }
  }, [user?.id, saveSubscriptionToSupabase, toast]);

  // Dispatch background notification via Service Worker
  const dispatchBackgroundNotification = useCallback(
    (title: string, options?: NotificationOptions & { url?: string; type?: string }) => {
      if (Notification.permission !== "granted") return;

      // Prefer Service Worker registration showNotification
      if (swRegRef.current && "showNotification" in swRegRef.current) {
        swRegRef.current.showNotification(title, {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          ...options,
        });
      } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_BACKGROUND_NOTIFICATION",
          payload: { title, options },
        });
      } else {
        // Fallback to Window Notification
        try {
          const n = new Notification(title, {
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            ...options,
          });
          if (options?.url) {
            n.onclick = () => {
              window.focus();
              window.location.href = options.url!;
            };
          }
        } catch (e) {
          console.warn("[PWA] Fallback Notification error:", e);
        }
      }
    },
    []
  );

  // Send a test notification (via VAPID server push or local service worker fallback)
  const sendTestNotification = useCallback(async () => {
    let granted = permission === "granted";
    if (!granted) {
      granted = await requestPermission();
    }
    if (granted) {
      let sentViaServer = false;

      // Ensure we have an active, freshly renewed subscription in Supabase before sending test push
      if (swRegRef.current && user?.id) {
        await registerPushSubscription(swRegRef.current, user.id, true);
      }

      // Try Supabase Edge Function send-push dispatch
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && user?.id) {
          const { data, error } = await supabase.functions.invoke("send-push", {
            body: {
              userId: user.id,
              user_id: user.id,
              title: "🎉 duogo: It's a Mutual Match!",
              body: "Lock screen push received! You are all set to get alerts when closed.",
              url: "/matches",
              type: "mutual_match",
              tag: `duogo-test-${Date.now()}`,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (!error && data?.sentCount > 0) {
            sentViaServer = true;
          }
        }
      } catch (err) {
        console.warn("[PWA Push] Supabase send-push test error:", err);
      }

      // If server push wasn't available or errored, try express dispatch or local SW notification
      if (!sentViaServer) {
        try {
          if (swRegRef.current && "pushManager" in swRegRef.current) {
            const sub = await swRegRef.current.pushManager.getSubscription();
            if (sub) {
              const { data: { session } } = await supabase.auth.getSession();
              const resp = await fetch("/api/push/dispatch", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({
                  subscription: sub.toJSON(),
                  userId: user?.id,
                  title: "🎉 duogo: It's a Mutual Match!",
                  body: "Lock screen push received! You are all set to get alerts when closed.",
                  url: "/matches",
                  type: "mutual_match",
                }),
              });
              if (resp.ok) {
                sentViaServer = true;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Fallback to local background notification if no server push was delivered
      if (!sentViaServer) {
        dispatchBackgroundNotification("🎉 duogo: Notification Preview", {
          body: "Preview alert. To receive lock-screen push when closed, verify VAPID keys in Supabase Edge Functions.",
          url: "/matches",
          type: "mutual_match",
          tag: "duogo-test-notification",
        });
      }

      toast({
        title: sentViaServer ? "⚡ Server Push (VAPID) Sent!" : "Local Notification Dispatched",
        description: sentViaServer
          ? "Delivered through FCM/APNs. Check your lock screen or phone notification shade."
          : "Dispatched locally in browser. For lock-screen alerts when closed, ensure VAPID keys are configured in Supabase.",
      });
    }
  }, [permission, requestPermission, registerPushSubscription, dispatchBackgroundNotification, toast, user?.id]);

  // Listen for Realtime incoming messages and notifications when user is authenticated
  useEffect(() => {
    if (!user) return;

    const instanceId = Math.random().toString(36).substring(2, 9);

    // Realtime listener for incoming messages across all conversations
    const messagesChannel = supabase
      .channel(`push-messages:${user.id}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            match_id: string;
            sender_id: string;
            content: string;
          };

          // Only notify if message is from the other person
          if (newMsg.sender_id !== user.id) {
            // Check if app is in background OR user is not currently in this chat
            const isTabHidden = document.visibilityState === "hidden";
            const currentPath = window.location.pathname;
            const isInThisChat = currentPath.includes(newMsg.match_id);

            if (isTabHidden || !isInThisChat) {
              // Fetch sender profile name
              let senderName = "Your Match";
              try {
                const { data } = await supabase
                  .from("profiles")
                  .select("first_name")
                  .eq("id", newMsg.sender_id)
                  .single();
                if (data?.first_name) {
                  senderName = data.first_name;
                }
              } catch {
                // ignore
              }

              dispatchBackgroundNotification(`💬 New message from ${senderName}`, {
                body: newMsg.content.length > 80 ? `${newMsg.content.substring(0, 80)}...` : newMsg.content,
                url: `/match/${newMsg.match_id}/chat`,
                type: "chat",
                tag: `duogo-chat-${newMsg.match_id}`,
              });
            }
          }
        }
      )
      .subscribe();

    // Realtime listener for incoming match & connect notifications
    const notificationsChannel = supabase
      .channel(`push-notifications:${user.id}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as {
            id: string;
            message: string;
            link: string | null;
          };

          const isTabHidden = typeof document !== "undefined" ? document.visibilityState === "hidden" : true;
          const notifTitle = notif.message?.includes("Mutual Match")
            ? "🎉 It's a Mutual Match!"
            : notif.message?.includes("connect")
            ? "✨ New Match Request!"
            : "✨ duogo Update";

          if (isTabHidden) {
            dispatchBackgroundNotification(notifTitle, {
              body: notif.message,
              url: notif.link || "/notifications",
              type: "match",
              tag: `duogo-notif-${notif.id || Date.now()}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, dispatchBackgroundNotification]);

  return {
    isSupported,
    permission,
    isSubscribed,
    hasVapidKey,
    requestPermission,
    sendTestNotification,
    resetAndReconnectPush,
    dispatchBackgroundNotification,
    unsubscribeFromPush,
  };
}


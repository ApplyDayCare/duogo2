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
  dispatchBackgroundNotification: (title: string, options?: NotificationOptions & { url?: string; type?: string }) => void;
  unsubscribeFromPush: () => Promise<boolean>;
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

export function usePushNotifications(): PushNotificationState {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "") as string;
  const hasVapidKey = Boolean(vapidPublicKey && vapidPublicKey.trim().length > 0);

  // Sync PushSubscription to Supabase
  const saveSubscriptionToSupabase = useCallback(async (subscription: PushSubscription, userId: string) => {
    try {
      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;

      if (!subscription.endpoint || !p256dh || !auth) return;

      const { error } = await supabase
        .from("push_subscriptions" as any)
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) {
        // Fallback or non-blocking warn (e.g. if table migration hasn't run yet)
        console.warn("[PWA Push] Supabase push_subscriptions upsert:", error.message);
      }
    } catch (err) {
      console.warn("[PWA Push] Failed to sync subscription:", err);
    }
  }, []);

  // Register push subscription via PushManager
  const registerPushSubscription = useCallback(
    async (reg: ServiceWorkerRegistration, userId?: string): Promise<PushSubscription | null> => {
      try {
        if (!("pushManager" in reg)) return null;

        let sub = await reg.pushManager.getSubscription();

        if (!sub && hasVapidKey && vapidPublicKey) {
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
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
    [hasVapidKey, vapidPublicKey, saveSubscriptionToSupabase]
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

      // Try server-side VAPID dispatch first
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
                body: "You and Alex & Jordan both connected! Tap to plan your double date.",
                url: "/matches",
                type: "mutual_match",
              }),
            });
            if (resp.ok) {
              sentViaServer = true;
            }
          }
        }
      } catch (err) {
        console.warn("[PWA Push] Server VAPID push test error:", err);
      }

      // If server push wasn't available or errored, use service worker background push
      if (!sentViaServer) {
        dispatchBackgroundNotification("🎉 duogo: It's a Mutual Match!", {
          body: "You and Alex & Jordan both connected! Tap to plan your double date.",
          url: "/matches",
          type: "mutual_match",
          tag: "duogo-test-notification",
        });
      }

      toast({
        title: sentViaServer ? "⚡ Server Push (VAPID) Sent!" : "Test Notification Dispatched",
        description: "If the tab is minimized or your phone is locked, check your notifications.",
      });
    }
  }, [permission, requestPermission, dispatchBackgroundNotification, toast, user?.id]);

  // Listen for Realtime incoming messages and notifications when user is authenticated
  useEffect(() => {
    if (!user) return;

    // Realtime listener for incoming messages across all conversations
    const messagesChannel = supabase
      .channel("global-push-messages")
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
      .channel("global-push-notifications")
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
    dispatchBackgroundNotification,
    unsubscribeFromPush,
  };
}


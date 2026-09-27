import { supabase } from "@/integrations/supabase/client";
import { getEffectiveVapidPublicKey } from "@/hooks/usePushNotifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported in this browser.");
    return false;
  }

  const effectiveKey = await getEffectiveVapidPublicKey();
  if (!effectiveKey) {
    console.warn("VAPID public key is not configured.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    const applicationServerKey = urlBase64ToUint8Array(effectiveKey) as BufferSource;

    // If subscription already exists with different key, unsubscribe first
    if (subscription && subscription.options && subscription.options.applicationServerKey) {
      const existingKey = new Uint8Array(subscription.options.applicationServerKey);
      const targetKey = new Uint8Array(applicationServerKey as ArrayBuffer);
      const match = existingKey.length === targetKey.length && existingKey.every((v, i) => v === targetKey[i]);
      if (!match) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.warn("Push subscription missing required keys.");
      return false;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) {
      return false;
    }

    await supabase.from("push_subscriptions" as any).upsert(
      {
        user_id: userData.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

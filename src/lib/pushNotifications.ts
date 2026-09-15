import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
    console.warn("Push notifications are not supported or VAPID_PUBLIC_KEY is not configured.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.warn("Push subscription missing required keys.");
      return false;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) {
      return false;
    }

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userData.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
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
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY);
}

export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

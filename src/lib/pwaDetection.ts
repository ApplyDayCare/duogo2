// PWA & Browser Environment Detection Utilities for duogo

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Checks if the app is running in standalone mode (already installed as PWA)
 */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

/**
 * Detects if the app is embedded inside an iframe (like AI Studio preview)
 */
export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Detects iOS devices (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // Also detect iPad on iOS 13+ which reports as Macintosh with touch points
  const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

/**
 * Detects Android devices
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

/**
 * Detects Mac Safari (Desktop Safari)
 */
export function isMacSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMac = /Macintosh|Mac OS X/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isMac && isSafari && !isIOS();
}

export type InAppBrowserType = "instagram" | "facebook" | "tiktok" | "whatsapp" | "twitter" | "snapchat" | "generic" | null;

/**
 * Detects if the user is visiting inside an in-app browser (e.g. Instagram, Facebook, TikTok, WhatsApp)
 */
export function detectInAppBrowser(): { isInApp: boolean; type: InAppBrowserType; name: string } {
  if (typeof window === "undefined") {
    return { isInApp: false, type: null, name: "" };
  }

  const ua = (navigator.userAgent || "").toLowerCase();

  if (ua.includes("instagram")) {
    return { isInApp: true, type: "instagram", name: "Instagram" };
  }
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab") || ua.includes("fb4a")) {
    return { isInApp: true, type: "facebook", name: "Facebook" };
  }
  if (ua.includes("tiktok") || ua.includes("bytedance") || ua.includes("musical_ly")) {
    return { isInApp: true, type: "tiktok", name: "TikTok" };
  }
  if (ua.includes("whatsapp")) {
    return { isInApp: true, type: "whatsapp", name: "WhatsApp" };
  }
  if (ua.includes("twitter") || ua.includes("tweetdeck")) {
    return { isInApp: true, type: "twitter", name: "X (Twitter)" };
  }
  if (ua.includes("snapchat")) {
    return { isInApp: true, type: "snapchat", name: "Snapchat" };
  }
  if (ua.includes("; wv") || ua.includes("version/4.0") || (isAndroid() && ua.includes("version/") && ua.includes("chrome/"))) {
    return { isInApp: true, type: "generic", name: "In-App Browser" };
  }

  return { isInApp: false, type: null, name: "" };
}

/**
 * Generates an Android Chrome intent URL so users in in-app browsers
 * (like Instagram, TikTok, Facebook) can open the current page directly in Google Chrome.
 */
export function getAndroidChromeIntentUrl(targetUrl?: string): string {
  if (typeof window === "undefined") return "";
  const rawUrl = targetUrl || window.location.href;
  
  try {
    const parsed = new URL(rawUrl);
    // Format: intent://<host><path+search>#Intent;scheme=https;package=com.android.chrome;end;
    const pathAndQuery = parsed.pathname + parsed.search + parsed.hash;
    return `intent://${parsed.host}${pathAndQuery}#Intent;scheme=https;package=com.android.chrome;end;`;
  } catch {
    return rawUrl;
  }
}

/**
 * Attempts to launch Google Chrome on Android via Android intent.
 */
export function openInAndroidChrome(targetUrl?: string): void {
  if (typeof window === "undefined") return;
  const intentUrl = getAndroidChromeIntentUrl(targetUrl);
  window.location.href = intentUrl;
}

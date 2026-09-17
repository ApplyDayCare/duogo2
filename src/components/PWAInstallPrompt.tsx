import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Download,
  Share,
  X,
  Smartphone,
  Check,
  Monitor,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowDown,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import {
  isStandaloneMode,
  isInIframe,
  isIOS,
  isAndroid,
  isMacSafari,
  detectInAppBrowser,
  openInAndroidChrome,
  BeforeInstallPromptEvent
} from "@/lib/pwaDetection";

interface PWAInstallPromptProps {
  variant?: "banner" | "button" | "card";
  className?: string;
}

type GuideType = "ios" | "in-app-android" | "android" | "desktop" | "mac-safari" | "iframe" | null;

export const PWAInstallPrompt = ({ variant = "banner", className = "" }: PWAInstallPromptProps) => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isMacSafariDevice, setIsMacSafariDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [inAppBrowserInfo, setInAppBrowserInfo] = useState<{ isInApp: boolean; name: string }>({
    isInApp: false,
    name: ""
  });
  const [activeGuide, setActiveGuide] = useState<GuideType>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Check standalone status
    setIsStandalone(isStandaloneMode());

    // 2. Check if in iframe
    setIsIframe(isInIframe());

    // 3. Check platforms & browsers
    setIsIOSDevice(isIOS());
    setIsAndroidDevice(isAndroid());
    setIsMacSafariDevice(isMacSafari());
    setInAppBrowserInfo(detectInAppBrowser());

    // 4. Check if global prompt was already captured in index.html
    if (typeof window !== "undefined") {
      if ((window as any).__pwaPrompt) {
        setDeferredPrompt((window as any).__pwaPrompt);
      }
      if ((window as any).__pwaInstalled) {
        setInstalled(true);
      }
    }

    // 5. Check localStorage dismissal
    const lastDismissed = localStorage.getItem("duogo_pwa_dismissed");
    if (lastDismissed && Date.now() - parseInt(lastDismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }

    // 6. Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as any).__pwaPrompt = promptEvent;
    };

    const readyHandler = (e: any) => {
      if (e.detail) {
        setDeferredPrompt(e.detail);
        (window as any).__pwaPrompt = e.detail;
      }
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== "undefined") {
        (window as any).__pwaPrompt = null;
      }
      setActiveGuide(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("pwa-prompt-ready", readyHandler);
    window.addEventListener("appinstalled", installedHandler);
    window.addEventListener("pwa-installed", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-prompt-ready", readyHandler);
      window.removeEventListener("appinstalled", installedHandler);
      window.removeEventListener("pwa-installed", installedHandler);
    };
  }, []);

  const directUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return "/";
  }, []);

  if (!user || isStandalone || installed) {
    return null;
  }

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt || (typeof window !== "undefined" ? (window as any).__pwaPrompt : null);

    // 1. PRIORITIZE DIRECT 1-CLICK NATIVE INSTALL:
    // If the browser provided beforeinstallprompt (standard Android Chrome & Desktop Chrome),
    // trigger the native system dialog INSTANTLY with zero intermediate instructional modals!
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          (window as any).__pwaPrompt = null;
        }
        return;
      } catch (err) {
        console.warn("PWA install error:", err);
      }
    }

    // 2. If running inside an iframe (like AI Studio preview), browser forbids native install
    if (isIframe) {
      setActiveGuide("iframe");
      return;
    }

    // 3. Android inside in-app browser (Instagram, Facebook, TikTok, WhatsApp, etc.)
    if (isAndroidDevice && inAppBrowserInfo.isInApp) {
      setActiveGuide("in-app-android");
      return;
    }

    // 4. iOS (iPhone / iPad) - Apple forbids programmatic prompt, show clear zero-clutter guide
    if (isIOSDevice) {
      setActiveGuide("ios");
      return;
    }

    // 5. Mac Safari
    if (isMacSafariDevice) {
      setActiveGuide("mac-safari");
      return;
    }

    // 6. Android fallback when native prompt was already dismissed or blocked
    if (isAndroidDevice) {
      setActiveGuide("android");
      return;
    }

    // 7. Desktop Chrome / Edge fallback
    setActiveGuide("desktop");
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("duogo_pwa_dismissed", Date.now().toString());
  };

  const copyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      toast.success("App link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <>
      {variant === "button" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className={`rounded-full gap-2 border-[#EBE3D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#181513] shadow-2xs transition-all cursor-pointer ${className}`}
        >
          <Download className="h-3.5 w-3.5 text-[#FF5436]" />
          <span>Install App</span>
        </Button>
      ) : !dismissed || activeGuide ? (
        <div
          className={`relative overflow-hidden rounded-2xl border border-[#FFD5CC] bg-gradient-to-r from-[#FFF5F2] via-white to-[#FFF5F2] p-3.5 shadow-soft transition-all duration-200 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5436] text-white shadow-2xs font-serif font-bold text-lg">
              d
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-[#181513]">Install duogo</p>
                <span className="rounded-full bg-[#FFE5DC] px-2 py-0.5 text-[9px] font-bold text-[#FF5436]">
                  Faster & Offline
                </span>
              </div>
              <p className="text-[11px] text-[#666059] truncate mt-0.5">
                Get instant notifications and a native full-screen experience.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="h-8 rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold px-3 shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Install
              </Button>
              <button
                onClick={handleDismiss}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#888177] hover:bg-black/5 transition-colors cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Device-Specific Guides rendered directly into Portal */}
      {activeGuide &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
            <div
              className="w-full max-w-sm rounded-[2rem] bg-white p-5 sm:p-6 shadow-2xl border border-[#EBE3D5] space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 relative"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE3]">
                <div className="flex items-center gap-2 font-serif text-base sm:text-lg font-bold text-[#181513]">
                  {activeGuide === "ios" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "in-app-android" && <Globe className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "android" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "iframe" && <ExternalLink className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "desktop" && <Monitor className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "mac-safari" && <Monitor className="h-5 w-5 text-[#FF5436]" />}

                  {activeGuide === "ios" && "Install on iPhone / iPad"}
                  {activeGuide === "in-app-android" && "Open in Google Chrome"}
                  {activeGuide === "android" && "Install on Android"}
                  {activeGuide === "iframe" && "Install App (Preview Mode)"}
                  {activeGuide === "desktop" && "Install on Desktop"}
                  {activeGuide === "mac-safari" && "Install on Mac Safari"}
                </div>
                <button
                  onClick={() => setActiveGuide(null)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[#888177] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 1. iOS Guide: Clean, animated visual card pointing down with zero clutter */}
              {activeGuide === "ios" && (
                <div className="space-y-4 text-xs text-[#5C5548] leading-relaxed">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-[#181513]">
                      Add duogo to your Home Screen
                    </p>
                    <p className="text-xs text-[#706A62]">
                      Fast, full-screen, and zero app-store download needed.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 rounded-2xl bg-[#FFF8F5] p-3.5 border border-[#FFD5CC]">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-xs font-bold">
                        1
                      </div>
                      <div className="flex-1 text-xs">
                        Tap the Safari <Share className="inline h-4 w-4 text-[#007AFF] mx-1 align-sub" /> <strong>Share</strong> icon in the bottom menu bar.
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl bg-[#FFF8F5] p-3.5 border border-[#FFD5CC]">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-xs font-bold">
                        2
                      </div>
                      <div className="flex-1 text-xs">
                        Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>, then tap <strong>Add</strong>.
                      </div>
                    </div>
                  </div>

                  {/* Animated bouncing arrow pointing down towards Safari's bottom bar */}
                  <div className="flex flex-col items-center justify-center pt-2 pb-1 text-[#FF5436]">
                    <span className="text-[11px] font-bold tracking-wide uppercase mb-1">
                      Look below in Safari
                    </span>
                    <div className="animate-bounce p-1.5 rounded-full bg-[#FFF0EB] border border-[#FFD5CC]">
                      <ArrowDown className="h-5 w-5 stroke-[2.5]" />
                    </div>
                  </div>

                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs shadow-soft cursor-pointer"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* 2. Android In-App Browser Guide: 1-Click "Open in Chrome" */}
              {activeGuide === "in-app-android" && (
                <div className="space-y-3.5 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#FFF8F5] p-3.5 border border-[#FFD5CC]">
                    <AlertCircle className="h-5 w-5 text-[#FF5436] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#181513] text-xs mb-0.5">
                        In-App Browser Detected {inAppBrowserInfo.name ? `(${inAppBrowserInfo.name})` : ""}
                      </p>
                      <p className="text-[#666059] text-[11.5px]">
                        In-app browsers restrict native 1-click installation. Switch to Google Chrome to install with a single tap.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      onClick={() => openInAndroidChrome(directUrl)}
                      className="w-full rounded-2xl h-12 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-sm shadow-[0_6px_20px_rgba(255,84,54,0.28)] gap-2 cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Google Chrome
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full rounded-2xl h-10 text-xs font-semibold border-[#EBE3D5] text-[#5C5548] gap-1.5 hover:bg-[#FAF7F2] cursor-pointer"
                      onClick={copyAppUrl}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy App Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Android Chrome Fallback (when native prompt event was already fired or dismissed) */}
              {activeGuide === "android" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-xs font-semibold text-[#181513]">
                    Install directly via Chrome:
                  </p>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      1
                    </div>
                    <p className="leading-snug">
                      Tap the <strong>three dots menu (⋮)</strong> in Chrome’s top right corner.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      2
                    </div>
                    <p className="leading-snug">
                      Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1 cursor-pointer"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* 4. Embedded Iframe Guide (AI Studio preview environment) */}
              {activeGuide === "iframe" && (
                <div className="space-y-3.5 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#FFF8F5] p-3.5 border border-[#FFD5CC]">
                    <AlertCircle className="h-5 w-5 text-[#FF5436] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#181513] text-xs mb-0.5">
                        Preview Iframe Restriction
                      </p>
                      <p className="text-[#666059] text-[11px]">
                        Browsers forbid PWA installation from inside an embedded preview iframe. Open in a new tab to trigger native 1-click install.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs shadow-soft gap-1.5 cursor-pointer"
                      onClick={() => setActiveGuide(null)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open duogo in New Tab
                    </a>

                    <Button
                      variant="outline"
                      className="w-full rounded-2xl h-10 text-xs font-semibold border-[#EBE3D5] text-[#5C5548] gap-1.5 hover:bg-[#FAF7F2] cursor-pointer"
                      onClick={copyAppUrl}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy App URL</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 5. Desktop Guide */}
              {activeGuide === "desktop" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-xs font-semibold text-[#181513]">
                    Install on desktop in Chrome or Edge:
                  </p>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      1
                    </div>
                    <p className="leading-snug">
                      Click the <Download className="inline h-3.5 w-3.5 text-[#FF5436] mx-0.5" /> <strong>Install</strong> icon in the right side of the address bar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      2
                    </div>
                    <p className="leading-snug">
                      Or click <strong>⋮</strong> → <strong>Save and share</strong> → <strong>Install duogo...</strong>
                    </p>
                  </div>
                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1 cursor-pointer"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* 6. Mac Safari Guide */}
              {activeGuide === "mac-safari" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-xs font-semibold text-[#181513]">
                    Install via Mac Safari:
                  </p>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      1
                    </div>
                    <p className="leading-snug">
                      In the top Mac menu bar, click <strong>File</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      2
                    </div>
                    <p className="leading-snug">
                      Select <strong>&quot;Add to Dock...&quot;</strong> and click <strong>Add</strong>.
                    </p>
                  </div>
                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1 cursor-pointer"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Download,
  Sparkles,
  X,
  Share,
  PlusSquare,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Check
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const MobileLandingInstallNudge = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [activeGuide, setActiveGuide] = useState<"ios" | "android" | "iframe" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode (already installed & opened as app)
    const standalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);
    setIsStandalone(standalone);

    if (standalone) return;

    // 2. Check if already dismissed recently (within 7 days)
    const dismissedTimestamp = localStorage.getItem("duogo_mobile_landing_nudge_dismissed");
    if (dismissedTimestamp) {
      const elapsed = Date.now() - parseInt(dismissedTimestamp, 10);
      if (elapsed < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // 3. Detect mobile device and platform
    const ua = navigator.userAgent || "";
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const androidDevice = /Android/i.test(ua);
    const hasTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const isMobileWidth = typeof window !== "undefined" && window.innerWidth <= 768;
    const mobileUser = iosDevice || androidDevice || (hasTouch && isMobileWidth);

    setIsMobile(mobileUser);
    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);

    // 4. Detect iframe preview restriction
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    setIsInIframe(inIframe);

    // If not on mobile browser, don't show the mobile-specific landing nudge
    if (!mobileUser) return;

    // 5. Retrieve or listen for native install prompt
    if (typeof window !== "undefined") {
      if ((window as any).__pwaPrompt) {
        setDeferredPrompt((window as any).__pwaPrompt);
      }
    }

    const promptHandler = (e: any) => {
      e.preventDefault();
      const promptEvent = (e.detail || e) as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as any).__pwaPrompt = promptEvent;
    };

    const installedHandler = () => {
      setIsVisible(false);
      localStorage.setItem("duogo_mobile_landing_nudge_dismissed", Date.now().toString());
    };

    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener("pwa-prompt-ready", promptHandler);
    window.addEventListener("appinstalled", installedHandler);
    window.addEventListener("pwa-installed", installedHandler);

    // 6. Subtle, non-intrusive delayed entrance (1.5 seconds after landing)
    const entranceTimer = setTimeout(() => {
      setIsVisible(true);
    }, 1500);

    return () => {
      clearTimeout(entranceTimer);
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("pwa-prompt-ready", promptHandler);
      window.removeEventListener("appinstalled", installedHandler);
      window.removeEventListener("pwa-installed", installedHandler);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("duogo_mobile_landing_nudge_dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    // 1. If native prompt is available (Android / Chromium)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsVisible(false);
          localStorage.setItem("duogo_mobile_landing_nudge_dismissed", Date.now().toString());
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn("PWA prompt trigger error:", err);
      }
    }

    // 2. If inside iframe (AI Studio preview environment)
    if (isInIframe) {
      setActiveGuide("iframe");
      return;
    }

    // 3. If on iOS Safari
    if (isIOS) {
      setActiveGuide("ios");
      return;
    }

    // 4. Fallback for Android Chrome without prompt event
    if (isAndroid) {
      setActiveGuide("android");
      return;
    }

    // Default fallback
    setActiveGuide("iframe");
  };

  const directUrl = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";

  const copyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "App URL copied. Paste it into your mobile Safari or Chrome browser.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL from your address bar.",
        variant: "destructive",
      });
    }
  };

  if (!isMobile || isStandalone || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Subtle Floating Bottom Nudge */}
      <aside
        id="mobile-landing-install-nudge"
        aria-label="Install duogo application"
        className="fixed bottom-3 inset-x-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[390px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[#FFD5CC] bg-white/95 backdrop-blur-md p-3 sm:p-3.5 shadow-[0_8px_30px_rgba(255,84,54,0.16)]">
          {/* Subtle brand top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF5436] via-[#FF8A75] to-[#FF5436]" />

          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5436] to-[#EE3F20] text-white shadow-2xs font-serif font-bold text-lg mt-0.5">
              d
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#FF5436] shadow-xs">
                <Sparkles className="h-2.5 w-2.5 fill-[#FF5436]" />
              </span>
            </div>

            {/* Copy & Details */}
            <div className="flex-1 min-w-0 pr-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-serif text-[13.5px] font-bold text-[#181513] leading-tight">
                  Install duogo
                </span>
                <span className="rounded-full bg-[#FFF0EB] border border-[#FFD5CC] px-1.5 py-0.2 text-[9px] font-bold text-[#FF5436] tracking-wide uppercase">
                  Better Experience
                </span>
              </div>

              <p className="text-[11.5px] text-[#666059] leading-snug mt-1">
                Install for a smoother, more integrated experience with instant match alerts and full-screen ease.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2.5">
                <Button
                  id="btn-nudge-install-app"
                  size="sm"
                  onClick={handleInstall}
                  className="h-7.5 rounded-xl bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold px-3 shadow-2xs transition-all active:scale-95 gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Install App</span>
                </Button>

                <button
                  id="btn-nudge-maybe-later"
                  type="button"
                  onClick={handleDismiss}
                  className="text-[11px] font-medium text-[#8C827A] hover:text-[#181513] px-2 py-1 transition-colors cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            </div>

            {/* Dismiss Cross */}
            <button
              id="btn-nudge-close"
              type="button"
              onClick={handleDismiss}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8C827A] hover:text-[#181513] hover:bg-black/5 transition-colors -mr-1 -mt-1 cursor-pointer"
              aria-label="Dismiss install nudge"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Guide Dialog for iOS, Android fallback, or Preview iframe */}
      {activeGuide &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-[#EBE3D5] space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE3]">
                <div className="flex items-center gap-2 font-serif text-base font-bold text-[#181513]">
                  {activeGuide === "ios" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "android" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "iframe" && <ExternalLink className="h-5 w-5 text-[#FF5436]" />}

                  {activeGuide === "ios" && "Install on iPhone / iPad"}
                  {activeGuide === "android" && "Install on Android"}
                  {activeGuide === "iframe" && "Install App (Preview Mode)"}
                </div>
                <button
                  onClick={() => setActiveGuide(null)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[#888177] hover:bg-[#FAF7F2] transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* iOS Safari Guide */}
              {activeGuide === "ios" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-[#181513] font-medium">
                    Add duogo to your iPhone home screen in two simple steps:
                  </p>

                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      1
                    </div>
                    <p className="leading-snug">
                      Tap the <Share className="inline h-3.5 w-3.5 text-[#FF5436] mx-0.5" /> <strong>Share</strong> button at the bottom of Safari.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      2
                    </div>
                    <p className="leading-snug">
                      Scroll down and tap <PlusSquare className="inline h-3.5 w-3.5 text-[#FF5436] mx-0.5" /> <strong>"Add to Home Screen"</strong>, then tap <strong>Add</strong>.
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-full h-10 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1"
                    onClick={() => {
                      setActiveGuide(null);
                      handleDismiss();
                    }}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* Android Guide */}
              {activeGuide === "android" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      1
                    </div>
                    <p className="leading-snug">
                      Tap the <strong>three dots menu (⋮)</strong> in the top-right corner of Chrome.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                      2
                    </div>
                    <p className="leading-snug">
                      Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-full h-10 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1"
                    onClick={() => {
                      setActiveGuide(null);
                      handleDismiss();
                    }}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* Iframe Preview Guide */}
              {activeGuide === "iframe" && (
                <div className="space-y-3.5 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FFF8F5] p-3 border border-[#FFD5CC]">
                    <AlertCircle className="h-4 w-4 text-[#FF5436] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#181513] text-xs mb-0.5">
                        Preview Iframe Restriction
                      </p>
                      <p className="text-[#666059] text-[11px]">
                        Browsers forbid PWA installation from inside an embedded preview iframe. Open directly in a browser tab to install duogo.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center rounded-full h-10 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs shadow-xs gap-1.5"
                      onClick={() => setActiveGuide(null)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open duogo in New Tab
                    </a>

                    <Button
                      variant="outline"
                      className="w-full rounded-full h-9 text-xs font-semibold border-[#EBE3D5] text-[#5C5548] gap-1.5 hover:bg-[#FAF7F2]"
                      onClick={copyAppUrl}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
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
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

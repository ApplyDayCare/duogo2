import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Share,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowDown
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  isStandaloneMode,
  isIOS,
  isAndroid,
  detectInAppBrowser,
  openInAndroidChrome,
  BeforeInstallPromptEvent
} from "@/lib/pwaDetection";

export const OnboardingInstallNudge = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [inAppInfo, setInAppInfo] = useState<{ isInApp: boolean; name: string }>({
    isInApp: false,
    name: ""
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const standalone = isStandaloneMode();
    setIsStandalone(standalone);

    // 2. Check if dismissed this session
    const dismissed = sessionStorage.getItem("duogo_onboarding_install_dismissed") === "true";
    setIsDismissed(dismissed);

    // 3. Platform detection
    const iosDevice = isIOS();
    const androidDevice = isAndroid();
    const mobileViewport = window.innerWidth <= 768;
    const isMobileDevice = iosDevice || androidDevice || mobileViewport;

    setIsIOSDevice(iosDevice);
    setIsAndroidDevice(androidDevice);
    setIsMobile(isMobileDevice);
    setInAppInfo(detectInAppBrowser());

    // 4. Capture native install prompt
    if (typeof window !== "undefined") {
      if ((window as any).__pwaPrompt) {
        setDeferredPrompt((window as any).__pwaPrompt);
      }
      if ((window as any).__pwaInstalled) {
        setInstalled(true);
      }
    }

    const promptHandler = (e: any) => {
      if (e.detail) {
        setDeferredPrompt(e.detail);
      } else if (e.prompt) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      toast({
        title: "🎉 duogo installed!",
        description: "Open duogo from your home screen to continue your signup.",
      });
    };

    window.addEventListener("pwa-prompt-ready", promptHandler);
    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener("appinstalled", installedHandler);
    window.addEventListener("pwa-installed", installedHandler);

    return () => {
      window.removeEventListener("pwa-prompt-ready", promptHandler);
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("appinstalled", installedHandler);
      window.removeEventListener("pwa-installed", installedHandler);
    };
  }, []);

  // If already in installed app, already installed, dismissed, or on desktop, do not show
  if (isStandalone || installed || isDismissed || !isMobile) {
    return null;
  }

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt || (typeof window !== "undefined" ? (window as any).__pwaPrompt : null);

    // 1. PRIORITIZE DIRECT 1-CLICK NATIVE INSTALL:
    // If prompt is available, launch it directly! Zero menus or guides.
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast({
            title: "App Installing! 🚀",
            description: "Once installed, open duogo from your home screen to finish signup.",
          });
          setInstalled(true);
          setDeferredPrompt(null);
        }
        return;
      } catch (err) {
        console.warn("Prompt error:", err);
      }
    }

    // 2. If in-app browser on Android
    if (isAndroidDevice && inAppInfo.isInApp) {
      openInAndroidChrome();
      return;
    }

    // 3. Otherwise toggle device-specific instructions
    setShowGuide((prev) => !prev);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("duogo_onboarding_install_dismissed", "true");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#FF5436]/30 bg-gradient-to-br from-[#FFF9F6] via-[#FFF3EE] to-[#FAF4EE] p-4 shadow-md transition-all animate-in fade-in duration-300">
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 rounded-full p-1 text-[#8C827A] hover:bg-black/5 hover:text-[#2C2825] transition-colors cursor-pointer"
        title="Continue in browser"
        aria-label="Close install prompt"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* App Logo Badge */}
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#FFE0D6]">
          <img
            src="/icon-192.png"
            alt="duogo app icon"
            className="h-8 w-8 rounded-xl object-contain"
          />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF5436] text-[9px] text-white font-bold">
            📱
          </span>
        </div>

        <div className="flex-1 pr-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-bold text-[#1A1816]">
              Add duogo to Your Home Screen
            </h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wide bg-[#FF5436] text-white px-2 py-0.5 rounded-full">
              Instant Access
            </span>
          </div>
          <p className="mt-1 text-xs text-[#666059] leading-relaxed">
            Install for real-time match alerts and a native full-screen experience. Your progress syncs seamlessly.
          </p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="mt-3.5 space-y-2">
        {deferredPrompt ? (
          // 1-Click native install on Android/Chrome
          <Button
            onClick={handleInstallClick}
            className="w-full rounded-2xl bg-[#FF5436] hover:bg-[#E5482D] text-white font-bold text-xs h-10 shadow-soft cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Install App Directly (1-Click)
          </Button>
        ) : isAndroidDevice && inAppInfo.isInApp ? (
          // Android inside in-app browser (Instagram/WhatsApp/TikTok/Gmail)
          <Button
            onClick={() => openInAndroidChrome()}
            className="w-full rounded-2xl bg-[#FF5436] hover:bg-[#E5482D] text-white font-bold text-xs h-10 shadow-soft gap-1.5 cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Google Chrome to Install
          </Button>
        ) : isIOSDevice ? (
          // iOS Safari instructions toggle / guide
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="flex items-center justify-between w-full text-xs font-bold text-[#FF5436] bg-white/80 px-3.5 py-2.5 rounded-2xl border border-[#F3E5DC] cursor-pointer"
          >
            <span>How to install on iPhone / iPad (2 steps)</span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : (
          // Android Chrome fallback
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="flex items-center justify-between w-full text-xs font-bold text-[#FF5436] bg-white/80 px-3.5 py-2.5 rounded-2xl border border-[#F3E5DC] cursor-pointer"
          >
            <span>How to install on Android</span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}

        {/* Zero-clutter iOS instructions */}
        {isIOSDevice && showGuide && (
          <div className="rounded-2xl bg-white/95 p-3.5 border border-[#F3E5DC] text-xs text-[#4A453E] space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                1
              </span>
              <span className="text-xs">
                Tap Safari&apos;s <Share className="inline h-3.5 w-3.5 text-[#007AFF] align-sub mx-0.5" /> <strong>Share</strong> button at the bottom of your screen.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold">
                2
              </span>
              <span className="text-xs">
                Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>, then tap <strong>Add</strong>.
              </span>
            </div>
            <div className="flex flex-col items-center justify-center pt-1 text-[#FF5436]">
              <span className="text-[10px] font-bold uppercase tracking-wide">Look below in Safari</span>
              <ArrowDown className="h-4 w-4 animate-bounce mt-0.5 stroke-[2.5]" />
            </div>
          </div>
        )}

        {/* Android fallback instructions */}
        {!isIOSDevice && !deferredPrompt && !(isAndroidDevice && inAppInfo.isInApp) && showGuide && (
          <div className="rounded-2xl bg-white/95 p-3.5 border border-[#F3E5DC] text-xs text-[#4A453E] space-y-2 animate-in fade-in duration-200">
            <p>1. Tap the menu <strong>(⋮)</strong> in Chrome’s top right corner.</p>
            <p>2. Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
            <p>3. Open duogo from your Home Screen anytime.</p>
          </div>
        )}
      </div>

      {/* Dismiss / Continue in Browser Link */}
      <div className="mt-2.5 pt-2 border-t border-[#F2E4DA] flex items-center justify-between text-[11px]">
        <span className="text-[#8C827A]">Prefer not to install right now?</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="font-bold text-[#FF5436] hover:underline cursor-pointer"
        >
          Continue in browser &rarr;
        </button>
      </div>
    </div>
  );
};

export default OnboardingInstallNudge;

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, PlusSquare, Sparkles, X, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const OnboardingInstallNudge = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // 2. Check if dismissed this session
    const dismissed = sessionStorage.getItem("duogo_onboarding_install_dismissed") === "true";
    setIsDismissed(dismissed);

    // 3. Platform detection
    const ua = navigator.userAgent || "";
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const androidDevice = /Android/i.test(ua);
    const mobileViewport = window.innerWidth <= 768;
    const isMobileDevice = iosDevice || androidDevice || mobileViewport;

    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);
    setIsMobile(isMobileDevice);

    // Default open iOS instructions if on iOS so the user sees exactly what to do
    if (iosDevice) {
      setShowIOSInstructions(true);
    }

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

  // If already in installed app, already installed, dismissed, or on a wide desktop, do not show
  if (isStandalone || installed || isDismissed || !isMobile) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast({
            title: "App Installing! 🚀",
            description: "Once installed, open duogo from your home screen to finish signup.",
          });
          setInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn("Prompt error:", err);
      }
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      // Android / other browsers without deferred prompt: toggle instructions
      setShowIOSInstructions((prev) => !prev);
    }
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
        className="absolute top-2.5 right-2.5 rounded-full p-1 text-[#8C827A] hover:bg-black/5 hover:text-[#2C2825] transition-colors"
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
              Install App Before Signing Up
            </h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wide bg-[#FF5436] text-white px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>
          <p className="mt-1 text-xs text-[#666059] leading-relaxed">
            Save duogo to your phone first so your quiz responses, login session, and instant match alerts stay permanently connected.
          </p>
        </div>
      </div>

      {/* iOS Instructions Guide */}
      {isIOS ? (
        <div className="mt-3 rounded-xl bg-white/90 p-3 border border-[#F3E5DC] text-xs text-[#4A453E] space-y-2">
          <p className="font-bold text-[#1A1816] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#FF5436]" />
            How to install on your iPhone (10 seconds):
          </p>
          <ol className="space-y-1.5 pl-1 text-[11.5px] leading-snug">
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold mt-0.5">
                1
              </span>
              <span>
                Tap the Safari <strong>Share</strong> button{" "}
                <Share className="inline h-3.5 w-3.5 text-[#007AFF] align-text-bottom mx-0.5" />{" "}
                at the bottom of your screen.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold mt-0.5">
                2
              </span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>{" "}
                <PlusSquare className="inline h-3.5 w-3.5 text-[#007AFF] align-text-bottom mx-0.5" />.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[10px] font-bold mt-0.5">
                3
              </span>
              <span>
                Tap <strong>Add</strong>, then open <strong>duogo</strong> directly from your Home Screen to finish onboarding!
              </span>
            </li>
          </ol>
        </div>
      ) : (
        /* Android / Supporting Mobile Browsers */
        <div className="mt-3 flex flex-col gap-2">
          {deferredPrompt ? (
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="w-full rounded-xl bg-[#FF5436] hover:bg-[#E5482D] text-white font-bold text-xs h-9 shadow-sm"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Install duogo on Home Screen
            </Button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowIOSInstructions((v) => !v)}
                className="flex items-center justify-between w-full text-xs font-bold text-[#FF5436] bg-white/70 px-3 py-2 rounded-xl border border-[#F3E5DC]"
              >
                <span>How to install on Android Chrome</span>
                {showIOSInstructions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showIOSInstructions && (
                <div className="rounded-xl bg-white/90 p-3 border border-[#F3E5DC] text-[11.5px] text-[#4A453E] space-y-1 leading-snug">
                  <p>1. Tap the menu <strong>(⋮)</strong> in Chrome’s top right corner.</p>
                  <p>2. Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
                  <p>3. Open duogo from your Home Screen to complete your signup.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

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

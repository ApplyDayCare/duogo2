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
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
  variant?: "banner" | "button" | "card";
  className?: string;
}

type GuideType = "ios" | "android" | "desktop" | "mac-safari" | "iframe" | null;

export const PWAInstallPrompt = ({ variant = "banner", className = "" }: PWAInstallPromptProps) => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMacSafari, setIsMacSafari] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [activeGuide, setActiveGuide] = useState<GuideType>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 2. Detect if nested in an iframe (e.g. preview environment)
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    // 3. Detect platform
    const userAgent = navigator.userAgent || "";
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(userAgent);
    const isMac = /Macintosh|Mac OS X/.test(userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsMacSafari(isMac && isSafari && !isIOSDevice);

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
      (window as any).__pwaPrompt = null;
      setActiveGuide(null);
      toast.success("duogo installed successfully!");
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

    // 1. If native install prompt event is available, launch it directly
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast.success("duogo is now installing!");
          setInstalled(true);
        } else {
          toast.info("Installation prompt dismissed");
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
    if (isInIframe) {
      setActiveGuide("iframe");
      return;
    }

    // 3. If iOS Safari
    if (isIOS) {
      setActiveGuide("ios");
      return;
    }

    // 4. If Mac Safari (Safari 17+ supports File -> Add to Dock)
    if (isMacSafari) {
      setActiveGuide("mac-safari");
      return;
    }

    // 5. If Android (when prompt wasn't captured automatically)
    if (isAndroid) {
      setActiveGuide("android");
      return;
    }

    // 6. Desktop Chrome / Edge / Brave fallback guide
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
      toast.success("App URL copied to clipboard!");
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
          className={`rounded-full gap-2 border-[#EBE3D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#181513] shadow-2xs transition-all ${className}`}
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

      {/* Interactive Installation Modal rendered via Portal directly to body */}
      {activeGuide &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#EBE3D5] space-y-5 animate-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F5EDE3]">
                <div className="flex items-center gap-2.5 font-serif text-lg font-bold text-[#181513]">
                  {activeGuide === "iframe" && <ExternalLink className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "ios" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "android" && <Smartphone className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "desktop" && <Monitor className="h-5 w-5 text-[#FF5436]" />}
                  {activeGuide === "mac-safari" && <Monitor className="h-5 w-5 text-[#FF5436]" />}

                  {activeGuide === "iframe" && "Install App (Preview Mode)"}
                  {activeGuide === "ios" && "Install on iPhone / iPad"}
                  {activeGuide === "android" && "Install on Android"}
                  {activeGuide === "desktop" && "Install on Desktop (Chrome / Edge)"}
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

              {/* In-Iframe Explanation */}
              {activeGuide === "iframe" && (
                <div className="space-y-4 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#FFF8F5] p-3.5 border border-[#FFD5CC]">
                    <AlertCircle className="h-5 w-5 text-[#FF5436] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#181513] text-[13px] mb-1">
                        Browser Security Restriction
                      </p>
                      <p className="text-[#666059]">
                        Web browsers (Chrome, Safari, Edge) do not permit PWA installation from inside an embedded preview iframe.
                      </p>
                    </div>
                  </div>

                  <p className="text-[#181513] font-medium text-center">
                    To install duogo as a desktop or mobile application, open it directly in a browser tab:
                  </p>

                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center rounded-full h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-sm shadow-md transition-all gap-2"
                      onClick={() => setActiveGuide(null)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open duogo in New Tab
                    </a>

                    <Button
                      variant="outline"
                      className="w-full rounded-full h-10 text-xs font-semibold border-[#EBE3D5] text-[#5C5548] gap-1.5 hover:bg-[#FAF7F2]"
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
                          <span>Copy App URL to Clipboard</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Once opened in its own tab, the browser's <strong>Install</strong> button will automatically activate in the address bar and page!
                  </p>
                </div>
              )}

              {/* Desktop Chrome / Edge / Brave Guide */}
              {activeGuide === "desktop" && (
                <div className="space-y-3.5 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-[#181513] font-medium">
                    You can install duogo directly from your browser in two easy steps:
                  </p>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3.5 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-[#181513]">Look at the Address Bar</p>
                      <p className="text-[#666059] mt-0.5">
                        In Chrome, Edge, or Brave, check the right side of the address bar for the{" "}
                        <Download className="inline h-3.5 w-3.5 text-[#FF5436] mx-0.5" />{" "}
                        <strong>Install</strong> icon (computer monitor with a down arrow).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3.5 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-[#181513]">Or Use the Browser Menu</p>
                      <p className="text-[#666059] mt-0.5">
                        Click the three dots (<strong>⋮</strong>) in the top-right corner of Chrome → select{" "}
                        <strong>"Save and share"</strong> → click <strong>"Install duogo..."</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      className="w-full rounded-full h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs"
                      onClick={() => setActiveGuide(null)}
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Got it!
                    </Button>
                  </div>
                </div>
              )}

              {/* Mac Safari Guide */}
              {activeGuide === "mac-safari" && (
                <div className="space-y-3.5 text-xs text-[#5C5548] leading-relaxed">
                  <p className="text-[#181513] font-medium">
                    To install duogo as a standalone Mac application using Safari:
                  </p>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3.5 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-[#181513]">Open Safari Menu</p>
                      <p className="text-[#666059] mt-0.5">
                        In the top Mac menu bar, click on <strong>File</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3.5 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-[#181513]">Add to Dock</p>
                      <p className="text-[#666059] mt-0.5">
                        Select <strong>"Add to Dock..."</strong> and click <strong>Add</strong>.
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full rounded-full h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-2"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* iOS Safari Guide */}
              {activeGuide === "ios" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      1
                    </div>
                    <p>
                      In Safari, tap the <Share className="inline h-3.5 w-3.5 text-[#FF5436] mx-1" /> <strong>Share</strong> button at the bottom.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      2
                    </div>
                    <p>
                      Scroll down and tap <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      3
                    </div>
                    <p>
                      Tap <strong>Add</strong> in the top right. duogo will appear right on your home screen!
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-full h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1"
                    onClick={() => setActiveGuide(null)}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Got it!
                  </Button>
                </div>
              )}

              {/* Android Guide */}
              {activeGuide === "android" && (
                <div className="space-y-3 text-xs text-[#5C5548] leading-relaxed">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      1
                    </div>
                    <p>
                      In Chrome, tap the <strong>three dots menu (⋮)</strong> in the top-right corner.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      2
                    </div>
                    <p>
                      Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] p-3 border border-[#EBE3D5]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5436] text-white text-[11px] font-bold">
                      3
                    </div>
                    <p>
                      Tap <strong>Install</strong> to add duogo directly to your apps.
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-full h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs mt-1"
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

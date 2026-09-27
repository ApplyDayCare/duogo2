import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PushNotificationPrompt: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, requestPermission } = usePushNotifications();
  const [requesting, setRequesting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (
    dismissed ||
    !user ||
    !isSupported ||
    permission === "denied" ||
    isSubscribed ||
    permission === "granted"
  ) {
    return null;
  }

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const success = await requestPermission();
      if (success) {
        if (user?.id) {
          try {
            const storageKey = `duogo_notification_preferences_${user.id}`;
            const existing = localStorage.getItem(storageKey);
            const currentPrefs = existing ? JSON.parse(existing) : {};
            localStorage.setItem(storageKey, JSON.stringify({ ...currentPrefs, pushEnabled: true }));
          } catch {}
        }
        toast({
          title: "Notifications Enabled! 🔔",
          description: "You'll now receive instant alerts for matches and messages.",
        });
      } else {
        toast({
          title: "Could not enable notifications",
          description: "Permission was not granted or was dismissed.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error enabling notifications",
        description: err.message || "Please check your browser settings.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[#FFD9CE] bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F6] p-4 flex items-center justify-between gap-3 shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436]">
          <BellRing className="h-5 w-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1A1816] truncate">Get notified instantly</p>
          <p className="text-[11px] text-[#706A62] leading-tight">
            Enable lock-screen push alerts so you never miss a match or message.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold h-8 px-4 shadow-xs"
        >
          {requesting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enabling…
            </span>
          ) : (
            "Enable"
          )}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] text-[#9E978E] hover:text-[#1A1816] px-1.5 py-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;


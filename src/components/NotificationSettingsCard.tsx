import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Smartphone,
  Mail,
  Sparkles,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface NotificationPreferences {
  pushEnabled: boolean;
  matchAlerts: boolean;
  messageAlerts: boolean;
  weeklyDigest: boolean;
  meetupReminders: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  matchAlerts: true,
  messageAlerts: true,
  weeklyDigest: true,
  meetupReminders: true,
};

export const NotificationSettingsCard: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    unsubscribeFromPush,
    sendTestNotification,
    resetAndReconnectPush,
  } = usePushNotifications();

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Stored preferences in localStorage (scoped to user)
  const storageKey = user ? `duogo_notification_preferences_${user.id}` : "duogo_notification_preferences";

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs, storageKey]);

  // Synchronize pushEnabled preference whenever browser subscription or permission is active
  useEffect(() => {
    if (isSubscribed || permission === "granted") {
      setPrefs((prev) => {
        if (!prev.pushEnabled) {
          return { ...prev, pushEnabled: true };
        }
        return prev;
      });
    }
  }, [isSubscribed, permission]);

  const handleTogglePush = async (checked: boolean) => {
    setLoading(true);
    try {
      if (checked) {
        const granted = await requestPermission();
        if (granted) {
          setPrefs((prev) => ({ ...prev, pushEnabled: true }));
          toast({
            title: "Push Notifications Enabled",
            description: "This device is now registered to receive real-time alerts.",
          });
        }
      } else {
        await unsubscribeFromPush();
        setPrefs((prev) => ({ ...prev, pushEnabled: false }));
        toast({
          title: "Push Notifications Disabled",
          description: "This device will no longer receive pop-up alerts.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Failed to update push notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: value };
      toast({
        title: "Preferences saved",
        description: "Your notification settings have been updated.",
      });
      return updated;
    });
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      await sendTestNotification();
    } finally {
      setTesting(false);
    }
  };

  const [diagResult, setDiagResult] = useState<{
    serverKey?: string;
    clientKey?: string;
    keysMatch?: boolean;
    endpoint?: string;
    error?: string;
  } | null>(null);

  const handleResetPush = async () => {
    setResetting(true);
    try {
      const result = await resetAndReconnectPush();
      setDiagResult(result);
    } finally {
      setResetting(false);
    }
  };

  const pushStatusText = () => {
    if (!isSupported) return "Not supported on this browser";
    if (permission === "denied") return "Blocked in browser permissions";
    if (isSubscribed) return "Active on this device";
    if (permission === "granted") return "Permission granted (syncing)";
    return "Not enabled";
  };

  return (
    <Card className={`rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden ${className}`}>
      <CardHeader className="p-5 pb-3 border-b border-[#F5EDE3]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0EB] text-[#FF5436]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-[#1A1816]">App Notifications</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Manage how and when duogo alerts you
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              isSubscribed
                ? "border-green-200 bg-green-50 text-green-700"
                : permission === "denied"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isSubscribed ? "Push Active" : permission === "denied" ? "Push Blocked" : "Push Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Device Push Switch */}
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-[#FFF9F6] border border-[#FFD9CE]">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-[#FFD9CE] text-[#FF5436] mt-0.5">
              {isSubscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-[#706A62]" />}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1A1816]">Device Push Notifications</span>
              </div>
              <p className="text-[11px] text-[#706A62] leading-relaxed">
                Receive instant pop-up alerts on your phone screen when you get matched or messaged.
              </p>
              <p className="text-[10px] font-medium text-[#FF5436] pt-0.5">
                Status: {pushStatusText()}
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={Boolean((isSubscribed || permission === "granted") && prefs.pushEnabled !== false)}
            disabled={loading || !isSupported}
            onCheckedChange={handleTogglePush}
          />
        </div>

        {/* Lock screen / iOS guidance */}
        <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] text-[11px] text-[#706A62] space-y-1">
          <p className="font-bold text-[#1A1816] flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-[#FF5436]" />
            Lock-Screen & Background Alerts
          </p>
          <p className="text-[10px] leading-relaxed">
            • <strong>iPhone (iOS):</strong> Push notifications when closed require adding duogo to your Home Screen (tap Share <span className="font-mono text-xs">⎋</span> &rarr; &ldquo;Add to Home Screen&rdquo; in Safari).
          </p>
          <p className="text-[10px] leading-relaxed">
            • <strong>Android:</strong> Make sure notifications and background data are allowed for duogo or Chrome in your phone settings.
          </p>
        </div>

        {/* Warning if blocked */}
        {permission === "denied" && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Notifications are blocked in your browser</span>
              <p className="text-[10px] leading-relaxed">
                To enable alerts, tap the lock/settings icon next to your URL in the address bar and set Notifications to &ldquo;Allow&rdquo;.
              </p>
            </div>
          </div>
        )}

        {/* Notification Category Toggles */}
        <div className="space-y-3 pt-1">
          <span className="text-[11px] font-bold text-[#1A1816] uppercase tracking-wider">
            Alert Categories
          </span>

          <div className="space-y-2">
            {/* 1. Mutual Matches & Introductions */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#EFE8DD] hover:bg-[#FAF7F2] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#FF5436]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A1816]">New Matches & Introductions</p>
                  <p className="text-[10px] text-[#706A62]">Alert when two profiles mutually connect</p>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs.matchAlerts}
                onCheckedChange={(val) => handleTogglePref("matchAlerts", val)}
              />
            </div>

            {/* 2. Chat & Direct Messages */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#EFE8DD] hover:bg-[#FAF7F2] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#FF5436]">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A1816]">Direct Messages & Group Chats</p>
                  <p className="text-[10px] text-[#706A62]">Instant alert when a friend messages you</p>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs.messageAlerts}
                onCheckedChange={(val) => handleTogglePref("messageAlerts", val)}
              />
            </div>

            {/* 3. Weekly Digest & Community Matches */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#EFE8DD] hover:bg-[#FAF7F2] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#FF5436]">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A1816]">Weekly Digest & Activity</p>
                  <p className="text-[10px] text-[#706A62]">Curated weekly updates on people matching your vibe nearby</p>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs.weeklyDigest}
                onCheckedChange={(val) => handleTogglePref("weeklyDigest", val)}
              />
            </div>

            {/* 4. Meetup Pulse & Check-ins */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#EFE8DD] hover:bg-[#FAF7F2] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#FF5436]">
                  <Smartphone className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A1816]">Post-Meetup Pulse Feedback</p>
                  <p className="text-[10px] text-[#706A62]">Follow-up check-in 7 days after meeting friends</p>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs.meetupReminders}
                onCheckedChange={(val) => handleTogglePref("meetupReminders", val)}
              />
            </div>
          </div>
        </div>

        {/* Test Notification Action */}
        <div className="pt-2 border-t border-[#F5EDE3] flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[#706A62]">Verify your phone vibrates or receives an alert</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={resetting || !isSupported}
              onClick={handleResetPush}
              title="Purge cached Service Workers and resubscribe with verified key"
              className="rounded-full h-8 text-xs font-semibold border-[#EFE8DD] hover:border-[#FF5436] hover:text-[#FF5436] gap-1.5"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>{resetting ? "Purging SW..." : "Kill SW & Resync"}</span>
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={testing || !isSubscribed}
              onClick={handleSendTest}
              className="rounded-full h-8 text-xs font-semibold bg-[#FF5436] hover:bg-[#E84628] text-white gap-1.5 shadow-sm"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Test Push</span>
            </Button>
          </div>
        </div>

        {/* Live Diagnostics Card */}
        {diagResult && (
          <div className="mt-3 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EDE8E1] text-[11px] space-y-1 font-mono text-[#57524C]">
            <div className="flex items-center justify-between font-sans font-bold text-[#1A1816] text-xs pb-1 border-b border-[#E5DFD5]">
              <span>Push Diagnostics</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  diagResult.keysMatch
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {diagResult.keysMatch ? "✅ Keys Match 100%" : "❌ Key Mismatch"}
              </Badge>
            </div>
            <p className="truncate">
              <span className="font-bold text-[#1A1816]">Server VAPID:</span> {diagResult.serverKey?.slice(0, 18)}...
            </p>
            <p className="truncate">
              <span className="font-bold text-[#1A1816]">Device VAPID:</span> {diagResult.clientKey?.slice(0, 18)}...
            </p>
            {diagResult.endpoint && (
              <p className="truncate">
                <span className="font-bold text-[#1A1816]">Endpoint:</span> {diagResult.endpoint.slice(0, 32)}...
              </p>
            )}
            {diagResult.error && (
              <p className="text-red-600 font-sans">
                <span className="font-bold">Error:</span> {diagResult.error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default NotificationSettingsCard;

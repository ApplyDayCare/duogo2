import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, NotificationItem } from "@/contexts/NotificationsContext";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Bell,
  BellRing,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  MessageCircle,
  Heart,
  CheckCheck,
  RefreshCw,
} from "lucide-react";

export const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    refreshNotifications,
    markAllAsRead,
    markAsRead,
  } = useNotifications();

  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Push notification state (safely accessed without throwing)
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [enablingPush, setEnablingPush] = useState(false);

  // Check push notification support safely
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setPushSupported(true);
      try {
        setPushPermission(Notification.permission);
      } catch {
        setPushPermission("default");
      }
    } else {
      setPushSupported(false);
    }
  }, []);

  const requestPushPermission = async () => {
    if (!pushSupported || typeof window === "undefined" || !("Notification" in window)) return;
    setEnablingPush(true);
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === "granted" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && "showNotification" in reg) {
          reg.showNotification("✨ duogo Notifications Enabled", {
            body: "You'll now receive updates when couples match or message you!",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
          });
        }
      }
    } catch (err) {
      console.warn("Could not request notification permission:", err);
    } finally {
      setEnablingPush(false);
    }
  };

  // Safe relative date formatting that NEVER throws RangeError
  const formatTime = useCallback((dateStr: string | null | undefined): string => {
    if (!dateStr) return "Just now";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Recently";

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  }, []);

  // Automatically mark all notifications as read once they have been loaded and reviewed
  useEffect(() => {
    if (loading || notifications.length === 0) return;
    const hasUnread = notifications.some((n) => !n.read);
    if (hasUnread) {
      markAllAsRead();
    }
  }, [loading, notifications, markAllAsRead]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }

    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Filtered notifications
  const displayedNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const getNotificationIcon = (type?: NotificationItem["type"]) => {
    switch (type) {
      case "mutual":
        return <Sparkles className="h-4 w-4 text-[#FF5436]" />;
      case "match":
        return <Heart className="h-4 w-4 text-[#FF5436]" />;
      case "message":
        return <MessageCircle className="h-4 w-4 text-[#FF5436]" />;
      default:
        return <Bell className="h-4 w-4 text-[#FF5436]" />;
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-8 space-y-5 font-sans min-h-[calc(100dvh-5rem)]">
      {/* Top Header Bar with Back Button */}
      <div className="flex items-center justify-between gap-3 border-b border-[#EBE3D5] pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full border border-[#EBE3D5] bg-white text-[#181513] hover:bg-[#FAF7F2] shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#181513]">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF5436] px-1.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-xs text-[#666059] mt-0.5">
              Match alerts, messages, and community updates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              refreshNotifications();
            }}
            disabled={loading || refreshing}
            className="h-8 w-8 rounded-full text-[#666059] hover:text-[#181513] hover:bg-white"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-[#FF5436]")} />
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 rounded-full border-[#EBE3D5] bg-white text-xs font-semibold text-[#666059] hover:text-[#181513] hover:bg-[#FAF7F2] gap-1 px-3"
            >
              <CheckCheck className="h-3.5 w-3.5 text-[#FF5436]" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Read all</span>
            </Button>
          )}
        </div>
      </div>

      {/* Push Notification Opt-in Card */}
      {pushSupported && pushPermission !== "granted" && (
        <Card className="rounded-3xl border border-[#FFD5C8] bg-gradient-to-br from-[#FFF5F2] via-white to-[#FFF5F2] p-4 shadow-soft">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF5436] text-white shadow-xs">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#181513]">
                  Never miss an invite or message
                </p>
                <p className="text-[11px] text-[#666059]">
                  Get instant lock-screen notifications when couples want to connect.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={requestPushPermission}
              disabled={enablingPush}
              className="w-full sm:w-auto shrink-0 rounded-full bg-[#FF5436] text-xs font-bold text-white hover:bg-[#E03E22]"
            >
              {enablingPush ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Turn on notifications
            </Button>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer",
            filter === "all"
              ? "bg-[#181513] text-white shadow-2xs"
              : "bg-white border border-[#EBE3D5] text-[#666059] hover:text-[#181513]"
          )}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5",
            filter === "unread"
              ? "bg-[#FF5436] text-white shadow-2xs"
              : "bg-white border border-[#EBE3D5] text-[#666059] hover:text-[#181513]"
          )}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] font-extrabold",
                filter === "unread" ? "bg-white/25 text-white" : "bg-[#FF5436] text-white"
              )}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF5436]" />
          <p className="text-xs text-[#888177]">Loading your notifications...</p>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <Card className="rounded-3xl border border-[#EBE3D5] shadow-soft bg-white">
          <CardContent className="py-12 sm:py-16 text-center space-y-3 px-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
              {filter === "unread" ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <Bell className="h-7 w-7" />
              )}
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-serif text-lg font-bold text-[#181513]">
                {filter === "unread" ? "No unread notifications" : "All caught up!"}
              </h3>
              <p className="text-xs text-[#666059] leading-relaxed">
                {filter === "unread"
                  ? "You have reviewed all your alerts. Switch to 'All' to view your recent history."
                  : "When someone matches with you or sends a message, you'll see it here first."}
              </p>
            </div>

            <div className="pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="rounded-full border-[#EBE3D5] text-xs font-semibold px-4 h-9 hover:bg-[#FAF7F2]"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {displayedNotifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "rounded-2xl border transition-all duration-200",
                n.read
                  ? "border-[#EBE3D5] bg-white opacity-90"
                  : "border-[#FFD5C8] bg-gradient-to-r from-white via-white to-[#FFF9F7] shadow-2xs",
                n.link && "cursor-pointer hover:border-[#FF5436]/50 hover:shadow-card active:scale-[0.99]"
              )}
              onClick={() => handleNotificationClick(n)}
            >
              <CardContent className="p-3.5 sm:p-4 flex items-start gap-3.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 mt-0.5",
                    n.read ? "bg-[#FAF7F2] text-[#888177]" : "bg-[#FFF0EB] text-[#FF5436]"
                  )}
                >
                  {getNotificationIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs sm:text-sm leading-snug break-words",
                        n.read ? "text-[#4A453F] font-medium" : "text-[#181513] font-bold"
                      )}
                    >
                      {n.message}
                    </p>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-[#FF5436] shrink-0 mt-1.5" />
                    )}
                  </div>

                  <p className="text-[11px] text-[#888177] mt-1 flex items-center gap-1.5">
                    <span>{formatTime(n.created_at)}</span>
                    {n.link && (
                      <>
                        <span>•</span>
                        <span className="text-[#FF5436] font-semibold hover:underline">
                          View details →
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer link to Dashboard */}
      <div className="pt-2 pb-6 text-center">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
          className="w-full sm:w-auto rounded-full font-bold h-11 px-8 border-[#EBE3D5] bg-white text-xs text-[#181513] hover:bg-[#FAF7F2]"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Notifications;

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
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
import { useQueryClient } from "@tanstack/react-query";

interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  link: string | null;
  type?: "match" | "message" | "mutual" | "system";
}

export const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { requestPermission, permission: pushPermissionHook } = usePushNotifications();

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
  }, [pushPermissionHook]);

  const requestPushPermission = async () => {
    if (!pushSupported || typeof window === "undefined" || !("Notification" in window)) return;
    setEnablingPush(true);
    try {
      await requestPermission();
      if (typeof Notification !== "undefined") {
        setPushPermission(Notification.permission);
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

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  }, []);

  // Fetch notifications and synthesize real-time match events safely
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch from notifications table (guarded against missing table or RLS restrictions)
      const notifsPromise = supabase
        .from("notifications")
        .select("id, user_id, message, link, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // 2. Fetch pending & mutual matches for dynamic alerts
      const matchesPromise = supabase
        .from("matches")
        .select("id, user_a_id, user_b_id, user_a_action, user_b_action, status, created_at, updated_at")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in("status", ["pending", "mutual"])
        .order("updated_at", { ascending: false })
        .limit(30);

      const [notifsRes, matchesRes] = await Promise.allSettled([notifsPromise, matchesPromise]);

      const notifs: NotificationItem[] = [];
      const seenIds = new Set<string>();

      if (notifsRes.status === "fulfilled" && notifsRes.value.data) {
        for (const item of notifsRes.value.data) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          let type: NotificationItem["type"] = "system";
          const msg = (item.message || "").toLowerCase();
          if (msg.includes("match") || msg.includes("connect")) {
            type = msg.includes("mutual") ? "mutual" : "match";
          } else if (msg.includes("message") || msg.includes("chat")) {
            type = "message";
          }
          notifs.push({
            id: item.id,
            message: item.message,
            read: Boolean(item.read),
            created_at: item.created_at || new Date().toISOString(),
            link: item.link,
            type,
          });
        }
      }

      // Synthesize incoming requests and mutual matches if not already present
      if (matchesRes.status === "fulfilled" && matchesRes.value.data) {
        let readSynthesized: string[] = [];
        try {
          readSynthesized = JSON.parse(localStorage.getItem("duogo_read_synthesized_notifs") || "[]");
        } catch {
          // ignore
        }

        for (const m of matchesRes.value.data) {
          const isA = m.user_a_id === user.id;
          const hasIncoming = isA
            ? m.user_b_action === "accept" && !m.user_a_action
            : m.user_a_action === "accept" && !m.user_b_action;

          if (m.status === "pending" && hasIncoming) {
            const reqId = `match-req-${m.id}`;
            const exists = notifs.some(
              (n) => n.id === reqId || (n.link && n.link.includes(m.id))
            );
            if (!exists) {
              notifs.unshift({
                id: reqId,
                message: "✨ Someone reviewed your profile and wants to connect with you!",
                read: readSynthesized.includes(reqId),
                created_at: m.created_at || new Date().toISOString(),
                link: `/matches?tab=received&match_id=${m.id}`,
                type: "match",
              });
            }
          } else if (m.status === "mutual") {
            const mutualId = `match-mutual-${m.id}`;
            const matchLink = `/match-reveal/${m.id}`;
            const exists = notifs.some(
              (n) => n.id === mutualId || (n.link && n.link.includes(m.id))
            );
            if (!exists) {
              notifs.unshift({
                id: mutualId,
                message: "🎉 It's a Mutual Match! You both accepted each other.",
                read: readSynthesized.includes(mutualId),
                created_at: m.updated_at || m.created_at || new Date().toISOString(),
                link: matchLink,
                type: "mutual",
              });
            }
          }
        }
      }

      // Sort by created_at descending safely
      notifs.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
      });

      setNotifications(notifs);
    } catch (err) {
      console.warn("Error fetching notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load with fail-safe timer + Realtime subscription
  useEffect(() => {
    let isMounted = true;
    fetchNotifications();

    if (user) {
      const channel = supabase
        .channel(`public:notifications:user=${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        supabase.removeChannel(channel);
      };
    }

    // Fallback safety timeout: never stay in loading state longer than 4 seconds
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [fetchNotifications, user]);

  // Mark single or all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (!user) return;

    // Immediately zero out the query cache unread count so the bell badge clears without latency
    queryClient.setQueryData(["unread-notifications", user.id], 0);

    // Persist synthesized notifications as read
    try {
      const synIds = notifications.filter((n) => n.id.startsWith("match-")).map((n) => n.id);
      const existing = JSON.parse(localStorage.getItem("duogo_read_synthesized_notifs") || "[]");
      localStorage.setItem(
        "duogo_read_synthesized_notifs",
        JSON.stringify(Array.from(new Set([...existing, ...synIds])))
      );
    } catch {
      // ignore
    }

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      await queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    } catch (err) {
      console.warn("Could not mark notifications as read:", err);
    }
  }, [user, notifications, queryClient]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      // Optimistically update notifications state for this specific item only
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );

      if (user) {
        // Optimistically decrement unread count
        queryClient.setQueryData(["unread-notifications", user.id], (old: number | undefined) =>
          Math.max(0, (old ?? 1) - 1)
        );

        if (!notif.id.startsWith("match-")) {
          try {
            await supabase
              .from("notifications")
              .update({ read: true })
              .eq("id", notif.id)
              .eq("user_id", user.id);

            queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
          } catch (err) {
            console.warn("Error updating notification read status:", err);
          }
        } else {
          try {
            const existing = JSON.parse(localStorage.getItem("duogo_read_synthesized_notifs") || "[]");
            if (!existing.includes(notif.id)) {
              existing.push(notif.id);
              localStorage.setItem("duogo_read_synthesized_notifs", JSON.stringify(existing));
            }
          } catch {
            // ignore
          }
        }
      }
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

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

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
              setRefreshing(true);
              fetchNotifications();
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

      {/* Push Notification Opt-in Prompt (Non-intrusive) */}
      {pushSupported && pushPermission !== "granted" && (
        <Card className="rounded-2xl border border-[#FFE2D6] bg-gradient-to-br from-[#FFF9F6] to-white p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436] shrink-0 mt-0.5">
              <BellRing className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-xs font-bold text-[#181513]">
                Never miss a match or message
              </h3>
              <p className="text-[11px] text-[#666059] leading-relaxed">
                Turn on instant alerts to know right away when someone connects with your profile.
              </p>
              <div className="pt-1.5">
                <Button
                  size="sm"
                  onClick={requestPushPermission}
                  disabled={enablingPush}
                  className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold h-7 px-3.5 shadow-2xs gap-1.5"
                >
                  {enablingPush ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellRing className="h-3.5 w-3.5" />
                  )}
                  Enable Notifications
                </Button>
              </div>
            </div>
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

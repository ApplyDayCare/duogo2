import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  link: string | null;
  type?: "match" | "message" | "mutual" | "system";
}

interface NotificationsContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  refreshNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const LOCAL_STORAGE_READ_SYNTHESIZED_KEY = "duogo_read_synthesized_notifs";

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Compute unread count from the unified notifications list
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Keep react-query cache in sync so external queries read the exact same count
  useEffect(() => {
    if (user?.id) {
      queryClient.setQueryData(["unread-notifications", user.id], unreadCount);
    }
  }, [unreadCount, user?.id, queryClient]);

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isBackground) {
      setLoading(true);
    }

    try {
      // 1. Fetch direct in-app notifications
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
      const seenKeys = new Set<string>();

      if (notifsRes.status === "fulfilled" && notifsRes.value.data) {
        for (const item of notifsRes.value.data) {
          const dedupeKey = `${(item.message || "").trim().toLowerCase()}|${(item.link || "").trim().toLowerCase()}`;
          if (seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);

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
          readSynthesized = JSON.parse(localStorage.getItem(LOCAL_STORAGE_READ_SYNTHESIZED_KEY) || "[]");
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
              (n) =>
                n.id === reqId ||
                n.link?.includes(m.id) ||
                (n.message.toLowerCase().includes("connect") && n.link?.includes("/matches"))
            );
            if (!exists) {
              notifs.unshift({
                id: reqId,
                message: "✨ Someone reviewed your profile and wants to connect with you!",
                read: readSynthesized.includes(reqId),
                created_at: m.created_at || new Date().toISOString(),
                link: "/matches?tab=received",
                type: "match",
              });
            }
          } else if (m.status === "mutual") {
            const mutualId = `match-mutual-${m.id}`;
            const matchLink = `/match-reveal/${m.id}`;
            const exists = notifs.some(
              (n) =>
                n.id === mutualId ||
                n.link === matchLink ||
                n.message.toLowerCase().includes("mutual match")
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

      // Sort by created_at descending
      notifs.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
      });

      setNotifications(notifs);
    } catch (err) {
      console.warn("[NotificationsContext] Error fetching notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
  }, [fetchNotifications]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time listener for real-time notification changes across all tabs and routes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `user_a_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `user_b_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  // Mark all notifications as read across the entire application and database
  const markAllAsRead = useCallback(async () => {
    // 1. Optimistically update local state
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (!user) return;

    // 2. Clear query cache unread count immediately
    queryClient.setQueryData(["unread-notifications", user.id], 0);

    // 3. Mark all synthesized notification IDs in localStorage
    try {
      const synIds = notifications.filter((n) => n.id.startsWith("match-")).map((n) => n.id);
      const existing: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_READ_SYNTHESIZED_KEY) || "[]");
      localStorage.setItem(
        LOCAL_STORAGE_READ_SYNTHESIZED_KEY,
        JSON.stringify(Array.from(new Set([...existing, ...synIds])))
      );
    } catch {
      // ignore
    }

    // 4. Update database records
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      await queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    } catch (err) {
      console.warn("[NotificationsContext] Error marking all notifications read:", err);
    }
  }, [user, notifications, queryClient]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (id: string) => {
      // 1. Optimistically update local notifications
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      if (!user) return;

      if (id.startsWith("match-")) {
        try {
          const existing: string[] = JSON.parse(
            localStorage.getItem(LOCAL_STORAGE_READ_SYNTHESIZED_KEY) || "[]"
          );
          if (!existing.includes(id)) {
            existing.push(id);
            localStorage.setItem(
              LOCAL_STORAGE_READ_SYNTHESIZED_KEY,
              JSON.stringify(existing)
            );
          }
        } catch {
          // ignore
        }
      } else {
        try {
          await supabase
            .from("notifications")
            .update({ read: true })
            .eq("id", id)
            .eq("user_id", user.id);

          await queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
        } catch (err) {
          console.warn("[NotificationsContext] Error marking notification read:", err);
        }
      }
    },
    [user, queryClient]
  );

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshing,
        refreshNotifications,
        markAllAsRead,
        markAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
};

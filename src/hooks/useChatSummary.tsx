import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCouplePartnerId, resolveOtherId } from "@/lib/coupleUtils";
import { fetchBlockedUserIds } from "@/lib/blockService";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export interface ChatConversation {
  matchId: string;
  status: string;
  compatibilityScore: number;
  revealedAt: string | null;
  createdAt: string;
  expiresAt?: string | null;
  otherUser: {
    id: string;
    first_name: string;
    avatar_url: string | null;
    location_city: string | null;
    user_type: string;
    bio?: string | null;
  };
  partnerUser?: {
    id: string;
    first_name: string;
    avatar_url: string | null;
  } | null;
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface IncomingChatRequest {
  matchId: string;
  score: number;
  createdAt: string;
  otherUser: {
    id: string;
    first_name: string;
    avatar_url: string | null;
    location_city: string | null;
    user_type: string;
    bio?: string | null;
    looking_for?: string | null;
    age_group?: string | null;
  };
  partnerUser?: {
    id: string;
    first_name: string;
    avatar_url: string | null;
  } | null;
}

export interface ChatSummary {
  chats: ChatConversation[];
  incomingRequests: IncomingChatRequest[];
  totalUnreadMessages: number;
  incomingRequestsCount: number;
  totalChatAlerts: number;
}

export function getChatLastReadTimestamp(matchId: string): string | null {
  try {
    return localStorage.getItem(`duogo_chat_last_read_${matchId}`);
  } catch {
    return null;
  }
}

export function markChatAsReadInStorage(matchId: string): void {
  try {
    localStorage.setItem(`duogo_chat_last_read_${matchId}`, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("duogo_chat_read_event", { detail: { matchId } }));
  } catch {
    // ignore
  }
}

export function useChatSummary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const queryKey = useMemo(() => ["chat-summary", user?.id], [user?.id]);

  const { data, isLoading, refetch } = useQuery<ChatSummary>({
    queryKey,
    queryFn: async () => {
      if (!user) {
        return {
          chats: [],
          incomingRequests: [],
          totalUnreadMessages: 0,
          incomingRequestsCount: 0,
          totalChatAlerts: 0,
        };
      }

      const partnerId = await getCouplePartnerId(user.id);
      const filterParts = [`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`];
      if (partnerId) {
        filterParts.push(`user_a_id.eq.${partnerId},user_b_id.eq.${partnerId}`);
      }

      // Fetch blocked user IDs for current user and couple partner
      const blockedUserIds = await fetchBlockedUserIds(user.id);
      if (partnerId) {
        const partnerBlocked = await fetchBlockedUserIds(partnerId);
        partnerBlocked.forEach((id) => blockedUserIds.add(id));
      }

      // Fetch all matches for the user
      const { data: rawMatches } = await supabase
        .from("matches")
        .select("*")
        .or(filterParts.join(","))
        .in("status", ["mutual", "pending", "archived"])
        .order("created_at", { ascending: false });

      if (!rawMatches || rawMatches.length === 0) {
        return {
          chats: [],
          incomingRequests: [],
          totalUnreadMessages: 0,
          incomingRequestsCount: 0,
          totalChatAlerts: 0,
        };
      }

      // Deduplicate matches and filter out blocked users
      const seen = new Set<string>();
      const matches = rawMatches.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        const otherId = resolveOtherId(m, user.id, partnerId);
        if (blockedUserIds.has(otherId) || m.status === "blocked") return false;
        return true;
      });

      const mutualMatches = matches.filter((m) => m.status === "mutual" || m.status === "archived");
      const incomingMatchRecords = matches.filter((m) => {
        if (m.status !== "pending") return false;
        const isA = m.user_a_id === user.id || (partnerId && m.user_a_id === partnerId);
        const isB = m.user_b_id === user.id || (partnerId && m.user_b_id === partnerId);
        if (isA && m.user_b_action === "accept" && !m.user_a_action) return true;
        if (isB && m.user_a_action === "accept" && !m.user_b_action) return true;
        return false;
      });

      // Gather other user IDs
      const otherUserIds = Array.from(
        new Set(
          matches.map((m) => resolveOtherId(m, user.id, partnerId))
        )
      );

      // Fetch profiles of all other users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, avatar_url, location_city, user_type, bio, looking_for, age_group")
        .in("id", otherUserIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      // Identify any couple partner profiles on the other side
      const coupleUserIds = (profiles || [])
        .filter((p) => p.user_type === "couple")
        .map((p) => p.id);

      const partnerMap = new Map<string, { id: string; first_name: string; avatar_url: string | null }>();
      if (coupleUserIds.length > 0) {
        const { data: couples } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(
            coupleUserIds
              .map((id) => `partner_a_id.eq.${id},partner_b_id.eq.${id}`)
              .join(",")
          );

        if (couples && couples.length > 0) {
          const partnerIdsToFetch: { ownerId: string; partnerId: string }[] = [];
          for (const c of couples) {
            for (const ownerId of coupleUserIds) {
              if (c.partner_a_id === ownerId && c.partner_b_id) {
                partnerIdsToFetch.push({ ownerId, partnerId: c.partner_b_id });
              } else if (c.partner_b_id === ownerId && c.partner_a_id) {
                partnerIdsToFetch.push({ ownerId, partnerId: c.partner_a_id });
              }
            }
          }

          if (partnerIdsToFetch.length > 0) {
            const { data: partnerProfiles } = await supabase
              .from("profiles")
              .select("id, first_name, avatar_url")
              .in("id", partnerIdsToFetch.map((p) => p.partnerId));

            const pProfMap = new Map((partnerProfiles || []).map((p) => [p.id, p]));
            for (const item of partnerIdsToFetch) {
              const p = pProfMap.get(item.partnerId);
              if (p) {
                partnerMap.set(item.ownerId, {
                  id: p.id,
                  first_name: p.first_name || "Partner",
                  avatar_url: p.avatar_url,
                });
              }
            }
          }
        }
      }

      // Fetch messages for all mutual matches
      const mutualMatchIds = mutualMatches.map((m) => m.id);
      const messagesByMatch: Record<string, any[]> = {};
      if (mutualMatchIds.length > 0) {
        const { data: allMessages } = await supabase
          .from("messages")
          .select("id, match_id, content, created_at, sender_id")
          .in("match_id", mutualMatchIds)
          .order("created_at", { ascending: false });

        if (allMessages) {
          for (const msg of allMessages) {
            if (!messagesByMatch[msg.match_id]) {
              messagesByMatch[msg.match_id] = [];
            }
            messagesByMatch[msg.match_id].push(msg);
          }
        }
      }

      // Build active chat conversations
      let totalUnreadMessages = 0;
      const chats: ChatConversation[] = mutualMatches.map((m) => {
        const otherId = resolveOtherId(m, user.id, partnerId);
        const otherProf = profileMap.get(otherId) || {
          id: otherId,
          first_name: "Match",
          avatar_url: null,
          location_city: null,
          user_type: "solo",
          bio: null,
        };
        const partnerProf = partnerMap.get(otherId) || null;

        const matchMessages = messagesByMatch[m.id] || [];
        const lastMsg = matchMessages[0] || null;

        // Calculate unread count
        const lastReadTimestamp = getChatLastReadTimestamp(m.id);
        let unreadCount = 0;

        if (lastReadTimestamp) {
          unreadCount = matchMessages.filter(
            (msg) => msg.sender_id !== user.id && new Date(msg.created_at) > new Date(lastReadTimestamp)
          ).length;
        } else {
          // If never stored in localStorage, count all messages from other sender after user's last message
          const myLastMsg = matchMessages.find((msg) => msg.sender_id === user.id);
          if (myLastMsg) {
            unreadCount = matchMessages.filter(
              (msg) => msg.sender_id !== user.id && new Date(msg.created_at) > new Date(myLastMsg.created_at)
            ).length;
          } else {
            // User hasn't replied yet, all messages from other are unread
            unreadCount = matchMessages.filter((msg) => msg.sender_id !== user.id).length;
          }
        }

        totalUnreadMessages += unreadCount;

        return {
          matchId: m.id,
          status: m.status,
          compatibilityScore: m.compatibility_score || 91,
          revealedAt: m.revealed_at,
          createdAt: m.created_at,
          expiresAt: m.expires_at || null,
          otherUser: otherProf,
          partnerUser: partnerProf,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content,
                created_at: lastMsg.created_at,
                sender_id: lastMsg.sender_id,
                isFromMe: lastMsg.sender_id === user.id,
              }
            : null,
          unreadCount,
          updatedAt: lastMsg ? lastMsg.created_at : m.revealed_at || m.created_at,
        };
      });

      // Sort chats: unread first, then by most recent activity
      chats.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      // Build incoming requests
      const incomingRequests: IncomingChatRequest[] = incomingMatchRecords.map((m) => {
        const otherId = resolveOtherId(m, user.id, partnerId);
        const otherProf = profileMap.get(otherId) || {
          id: otherId,
          first_name: "Explorer",
          avatar_url: null,
          location_city: null,
          user_type: "solo",
          bio: null,
          looking_for: null,
          age_group: null,
        };
        const partnerProf = partnerMap.get(otherId) || null;

        return {
          matchId: m.id,
          score: m.compatibility_score || 92,
          createdAt: m.created_at,
          otherUser: otherProf,
          partnerUser: partnerProf,
        };
      });

      return {
        chats,
        incomingRequests,
        totalUnreadMessages,
        incomingRequestsCount: incomingRequests.length,
        totalChatAlerts: totalUnreadMessages,
      };
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Realtime Supabase listeners
  useEffect(() => {
    if (!user) return;

    // Listen for read events within this browser window
    const handleReadEvent = (e: Event) => {
      const matchId = (e as CustomEvent)?.detail?.matchId;
      queryClient.setQueryData(queryKey, (prev: ChatSummary | undefined) => {
        if (!prev) return prev;
        let countDiff = 0;
        const nextChats = prev.chats.map((c) => {
          if (c.matchId === matchId && c.unreadCount > 0) {
            countDiff += c.unreadCount;
            return { ...c, unreadCount: 0 };
          }
          return c;
        });
        return {
          ...prev,
          chats: nextChats,
          totalUnreadMessages: Math.max(0, prev.totalUnreadMessages - countDiff),
          totalChatAlerts: Math.max(0, prev.totalChatAlerts - countDiff),
        };
      });
    };

    window.addEventListener("duogo_chat_read_event", handleReadEvent);

    // Subscribe to Postgres changes on messages with unique channel names to avoid subscribe conflicts
    const chatChannelId = `global-chat-listener-${user.id}-${Math.random().toString(36).substring(7)}`;
    const messageChannel = supabase
      .channel(chatChannelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const newMsg = payload.new as { id: string; match_id: string; sender_id: string; content: string };
          if (newMsg.sender_id === user.id) return;

          // Check if current user is actively looking at this match's chat
          const isViewingChat = window.location.pathname.includes(`/match/${newMsg.match_id}/chat`);
          if (isViewingChat) {
            // Already viewing, just mark read in storage
            markChatAsReadInStorage(newMsg.match_id);
            return;
          }

          // Invalidate to refresh badges and state
          queryClient.invalidateQueries({ queryKey });

          // Fetch sender's name for instant notification
          const { data: senderProf } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", newMsg.sender_id)
            .single();

          const senderName = senderProf?.first_name || "Someone";
          const preview = newMsg.content.length > 50 ? newMsg.content.slice(0, 47) + "…" : newMsg.content;

          toast({
            title: `💬 ${senderName}`,
            description: preview,
            action: (
              <button
                onClick={() => navigate(`/match/${newMsg.match_id}/chat`)}
                className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white px-3 py-1 text-xs font-bold shadow-xs transition-colors shrink-0"
              >
                Reply
              </button>
            ),
          });
        }
      )
      .subscribe();

    // Subscribe to Postgres changes on matches with unique channel name
    const matchChannelId = `global-match-listener-${user.id}-${Math.random().toString(36).substring(7)}`;
    const matchChannel = supabase
      .channel(matchChannelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("duogo_chat_read_event", handleReadEvent);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [user, queryClient, queryKey, navigate]);

  const markAsRead = useCallback((matchId: string) => {
    markChatAsReadInStorage(matchId);
    queryClient.setQueryData(queryKey, (prev: ChatSummary | undefined) => {
      if (!prev) return prev;
      let countDiff = 0;
      const nextChats = prev.chats.map((c) => {
        if (c.matchId === matchId && c.unreadCount > 0) {
          countDiff += c.unreadCount;
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      return {
        ...prev,
        chats: nextChats,
        totalUnreadMessages: Math.max(0, prev.totalUnreadMessages - countDiff),
        totalChatAlerts: Math.max(0, prev.totalChatAlerts - countDiff),
      };
    });
  }, [queryClient, queryKey]);

  return {
    chats: data?.chats || [],
    incomingRequests: data?.incomingRequests || [],
    totalUnreadMessages: data?.totalUnreadMessages || 0,
    incomingRequestsCount: data?.incomingRequestsCount || 0,
    totalChatAlerts: data?.totalChatAlerts || 0,
    isLoading,
    refetch,
    markAsRead,
  };
}

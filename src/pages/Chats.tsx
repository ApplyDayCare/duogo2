import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSummary } from "@/hooks/useChatSummary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Search,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const {
    chats,
    totalUnreadMessages,
    incomingRequestsCount,
    isLoading,
    markAsRead,
  } = useChatSummary();

  // Fetch current user location for distance calculation
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-chat-location", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, location_city")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Filter conversations based on search
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase().trim();
    return chats.filter((c) => {
      const nameMatch = c.otherUser.first_name.toLowerCase().includes(q) ||
        (c.partnerUser?.first_name && c.partnerUser.first_name.toLowerCase().includes(q));
      const cityMatch = c.otherUser.location_city?.toLowerCase().includes(q);
      const msgMatch = c.lastMessage?.content.toLowerCase().includes(q);
      return nameMatch || cityMatch || msgMatch;
    });
  }, [chats, searchQuery]);

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isToday(d)) {
        return format(d, "h:mm a");
      }
      if (isYesterday(d)) {
        return "Yesterday";
      }
      return format(d, "MMM d");
    } catch {
      return "";
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#181513]">
              Chats & Messages
            </h1>
            {totalUnreadMessages > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF5436] px-2 text-xs font-bold text-white shadow-2xs">
                {totalUnreadMessages} new
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#666059] mt-0.5">
            Connect, plan meetups, and stay in touch with your verified duogo matches.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/matches")}
          className="rounded-full border-[#FFD5CC] bg-[#FFF5F2] hover:bg-[#FFEAE3] text-[#FF5436] font-semibold text-xs h-9 px-4 self-start sm:self-auto shadow-2xs gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Find New Matches</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888177]" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats by name, city, or message…"
          className="pl-10 h-10 rounded-2xl border-[#EBE3D5] bg-white text-xs sm:text-sm shadow-2xs focus-visible:ring-[#FF5436]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#888177] hover:text-[#181513]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-3 pt-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-4 rounded-3xl bg-white border border-[#EBE3D5] animate-pulse"
            >
              <div className="h-13 w-13 rounded-2xl bg-[#EFE8DD] shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-[#EFE8DD]" />
                <div className="h-3 w-48 rounded bg-[#EFE8DD]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ALL CHATS LIST */
        <div className="space-y-3">
          {filteredChats.length === 0 ? (
            <div className="rounded-3xl border border-[#EBE3D5] bg-white p-8 sm:p-12 text-center shadow-soft space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF5F2] text-[#FF5436] shadow-2xs">
                <MessageCircle className="h-7 w-7" />
              </div>

              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="font-serif text-lg font-bold text-[#181513]">
                  {searchQuery ? "No matching chats found" : "No active conversations yet"}
                </h3>
                <p className="text-xs sm:text-sm text-[#666059] leading-relaxed">
                  {searchQuery
                    ? "Try a different search term or clear the filter."
                    : "When you and another member accept each other, your private chat will appear here so you can connect and plan meetups."}
                </p>
              </div>

              {!searchQuery && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={() => navigate("/matches")}
                    className="rounded-full h-10 px-5 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white shadow-soft"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Review Weekly Matches
                  </Button>
                  {incomingRequestsCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/matches?tab=received")}
                      className="rounded-full h-10 px-5 font-bold border-[#FFD5CC] bg-[#FFF5F2] text-[#FF5436] hover:bg-[#FFEBE5] transition-colors shadow-soft"
                    >
                      Review Received Request ({incomingRequestsCount})
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isCouple = chat.otherUser.user_type === "couple" && chat.partnerUser;
              const displayName = isCouple
                ? `${chat.otherUser.first_name} & ${chat.partnerUser?.first_name}`
                : chat.otherUser.first_name;

              const distanceKm = calculateDistanceKm(
                myProfile?.location_city,
                chat.otherUser.location_city
              );

              const hasUnread = chat.unreadCount > 0;

              return (
                <div
                  key={chat.matchId}
                  onClick={() => {
                    markAsRead(chat.matchId);
                    navigate(`/match/${chat.matchId}/chat`);
                  }}
                  className={`group relative flex items-center justify-between p-4 sm:p-4.5 rounded-3xl border transition-all cursor-pointer select-none ${
                    hasUnread
                      ? "bg-gradient-to-r from-[#FFF5F2] via-white to-white border-[#FFBFAF] shadow-card hover:border-[#FF5436]"
                      : "bg-white border-[#EBE3D5] shadow-soft hover:border-[#FF5436]/40 hover:shadow-card"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Avatars */}
                    <div className="relative shrink-0">
                      {isCouple ? (
                        <div className="flex -space-x-3">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-2xs">
                            {chat.otherUser.avatar_url && (
                              <AvatarImage src={chat.otherUser.avatar_url} />
                            )}
                            <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-serif font-bold text-sm">
                              {chat.otherUser.first_name[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <Avatar className="h-12 w-12 border-2 border-white shadow-2xs">
                            {chat.partnerUser?.avatar_url && (
                              <AvatarImage src={chat.partnerUser.avatar_url} />
                            )}
                            <AvatarFallback className="bg-[#FAF7F2] text-[#181513] font-serif font-bold text-sm border border-[#EBE3D5]">
                              {chat.partnerUser?.first_name[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <Avatar className="h-13 w-13 border-2 border-white shadow-2xs">
                          {chat.otherUser.avatar_url && (
                            <AvatarImage src={chat.otherUser.avatar_url} />
                          )}
                          <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-serif font-bold text-base">
                            {chat.otherUser.first_name[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      {/* Active green indicator */}
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    {/* Chat Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4
                            className={`font-serif text-sm sm:text-base truncate ${
                              hasUnread ? "font-extrabold text-[#181513]" : "font-bold text-[#181513]"
                            }`}
                          >
                            {displayName}
                          </h4>
                          <Badge
                            variant="secondary"
                            className="bg-[#FAF7F2] text-[#666059] border border-[#EBE3D5] text-[10px] font-bold px-1.5 py-0 shrink-0"
                          >
                            {chat.compatibilityScore}%
                          </Badge>
                        </div>

                        <span className="text-[11px] font-semibold text-[#888177] shrink-0">
                          {chat.lastMessage
                            ? formatMessageTime(chat.lastMessage.created_at)
                            : "New"}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p
                          className={`text-xs truncate ${
                            hasUnread
                              ? "font-bold text-[#181513]"
                              : "text-[#666059]"
                          }`}
                        >
                          {chat.lastMessage ? (
                            <span>
                              {chat.lastMessage.isFromMe && (
                                <span className="text-[#888177] font-normal mr-1">You:</span>
                              )}
                              {chat.lastMessage.content}
                            </span>
                          ) : (
                            <span className="italic text-[#888177]">
                              Mutual match! Say hello 👋
                            </span>
                          )}
                        </p>

                        {/* Unread badge counter */}
                        {hasUnread && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5436] px-1.5 text-[10px] font-bold text-white shadow-2xs">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* City and distance */}
                      {chat.otherUser.location_city && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#888177]">
                          <MapPin className="h-3 w-3 text-[#FF5436]" />
                          <span>{chat.otherUser.location_city}</span>
                          {distanceKm !== null && <span>• {distanceKm.toFixed(1)} km away</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center pl-3">
                    <Button
                      size="sm"
                      className="rounded-full h-8 px-3.5 bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform"
                    >
                      Chat <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Chats;

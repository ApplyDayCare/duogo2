import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageCircle, Info, Sparkles, MapPin, Heart, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { AiIcebreakers } from "@/components/AiIcebreakers";
import { ChatIcebreakerCard } from "@/components/ChatIcebreakerCard";
import { MatchSidebarProfile } from "@/components/MatchSidebarProfile";
import MatchActions from "@/components/MatchActions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";

const QUICK_REPLIES = [
  { label: "Hey! Excited to connect", emoji: "👋" },
  { label: "Want to meet up for coffee?", emoji: "☕" },
  { label: "What neighborhood are you in?", emoji: "📍" },
  { label: "Running a bit late", emoji: "⏰" },
];

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

const MatchChat = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [showIcebreakerCard, setShowIcebreakerCard] = useState(false);
  const [isOtherUserInChat, setIsOtherUserInChat] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(() => {
    if (!matchId) return null;
    try {
      return localStorage.getItem(`duogo_chat_partner_last_read_${matchId}`);
    } catch {
      return null;
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch other user's profile and match details
  const { data: matchData } = useQuery({
    queryKey: ["match-chat-header", matchId],
    queryFn: async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId!)
        .single();
      if (!match) throw new Error("Match not found");

      // Determine "other side": could be current user's couple partner scenario
      const isDirectParticipant = match.user_a_id === user!.id || match.user_b_id === user!.id;
      let otherId: string;

      if (isDirectParticipant) {
        otherId = match.user_a_id === user!.id ? match.user_b_id : match.user_a_id;
      } else {
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${user!.id},partner_b_id.eq.${user!.id}`)
          .maybeSingle();

        const myPartnerId = couple
          ? couple.partner_a_id === user!.id ? couple.partner_b_id : couple.partner_a_id
          : null;

        if (myPartnerId === match.user_a_id) {
          otherId = match.user_b_id;
        } else {
          otherId = match.user_a_id;
        }
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, user_type, location_city, bio")
        .eq("id", otherId)
        .single();

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("first_name, avatar_url, location_city, user_type")
        .eq("id", user!.id)
        .single();

      // If the other side is a couple, also fetch their partner
      let partnerProfile: { first_name: string | null; avatar_url: string | null } | null = null;
      if (profile?.user_type === "couple") {
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${otherId},partner_b_id.eq.${otherId}`)
          .maybeSingle();
        if (couple) {
          const pId = couple.partner_a_id === otherId ? couple.partner_b_id : couple.partner_a_id;
          if (pId) {
            const { data: pp } = await supabase
              .from("profiles")
              .select("first_name, avatar_url")
              .eq("id", pId)
              .single();
            partnerProfile = pp;
          }
        }
      }

      return { match, otherProfile: profile, partnerProfile, otherId, myProfile };
    },
    enabled: !!user && !!matchId,
  });

  const fetchMessages = useCallback(async () => {
    if (!matchId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, created_at, sender_id")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Failed to load messages", variant: "destructive" });
    }
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [matchId, toast]);

  useEffect(() => {
    if (!matchId || !user) return;
    fetchMessages();

    // Mark current chat as read locally
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(`duogo_chat_last_read_${matchId}`, nowIso);
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }

    const channel = supabase.channel(`chat-${matchId}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: false },
      },
    });

    // Listen for broadcast read receipts from match partner
    channel.on("broadcast", { event: "read_receipt" }, (payload) => {
      const { readerId, readAt } = payload.payload || {};
      if (readerId && readerId !== user.id) {
        const timestamp = readAt || new Date().toISOString();
        setOtherLastReadAt((prev) => {
          if (!prev || new Date(timestamp) > new Date(prev)) {
            try {
              localStorage.setItem(`duogo_chat_partner_last_read_${matchId}`, timestamp);
            } catch {
              // ignore
            }
            return timestamp;
          }
          return prev;
        });
      }
    });

    // Realtime presence tracking for "Active in chat" status & instant read receipts
    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const otherPresent = Object.keys(presenceState).some((key) => key !== user.id);
        setIsOtherUserInChat(otherPresent);
        if (otherPresent) {
          const now = new Date().toISOString();
          setOtherLastReadAt(now);
          try {
            localStorage.setItem(`duogo_chat_partner_last_read_${matchId}`, now);
          } catch {
            // ignore
          }
        }
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key !== user.id) {
          setIsOtherUserInChat(true);
          const now = new Date().toISOString();
          setOtherLastReadAt(now);
          try {
            localStorage.setItem(`duogo_chat_partner_last_read_${matchId}`, now);
          } catch {
            // ignore
          }
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key !== user.id) {
          setIsOtherUserInChat(false);
        }
      });

    // Listen for incoming messages
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
      (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // If the message is from the partner, we are reading it right now
        if (newMsg.sender_id !== user.id) {
          const readTimestamp = new Date().toISOString();
          try {
            localStorage.setItem(`duogo_chat_last_read_${matchId}`, readTimestamp);
            window.dispatchEvent(new Event("storage"));
          } catch {
            // ignore
          }
          channel.send({
            type: "broadcast",
            event: "read_receipt",
            payload: { readerId: user.id, readAt: readTimestamp },
          });
        }
      }
    );

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: user.id,
          onlineAt: new Date().toISOString(),
        });
        // Broadcast that we've read everything up to now
        channel.send({
          type: "broadcast",
          event: "read_receipt",
          payload: { readerId: user.id, readAt: new Date().toISOString() },
        });
      }
    });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [matchId, user, fetchMessages]);

  useEffect(() => {
    if (matchData?.match && matchData.match.status !== "mutual") {
      toast({
        title: "Connection Pending 🔒",
        description: "This chat is locked until both profiles have connected back.",
        variant: "destructive",
      });
      navigate("/chats");
    }
  }, [matchData?.match, navigate, toast]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || !user || !matchId) return;
    const trimmed = content.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const { error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: user.id, content: trimmed });

    if (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
      return;
    }

    // Send push notification to other participant(s)
    if (matchData) {
      const match = matchData.match;
      const recipientIds: string[] = [];

      const directOtherId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
      recipientIds.push(directOtherId);

      if (matchData.otherProfile?.user_type === "couple" && matchData.partnerProfile) {
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${directOtherId},partner_b_id.eq.${directOtherId}`)
          .maybeSingle();
        if (couple) {
          const partnerId = couple.partner_a_id === directOtherId ? couple.partner_b_id : couple.partner_a_id;
          if (partnerId && partnerId !== user.id) recipientIds.push(partnerId);
        }
      }

      const senderName = (await supabase.from("profiles").select("first_name").eq("id", user.id).single()).data?.first_name || "Someone";
      const preview = trimmed.length > 50 ? trimmed.slice(0, 47) + "…" : trimmed;

      for (const recipientId of recipientIds) {
        supabase.functions
          .invoke("send-push", {
            body: {
              userId: recipientId,
              user_id: recipientId,
              title: `${senderName} sent a message`,
              body: preview,
              url: `/match/${matchId}/chat`,
              type: "chat_message",
            },
          })
          .catch(() => {});

        fetch("/api/push/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: recipientId,
            title: `${senderName} sent a message`,
            body: preview,
            url: `/match/${matchId}/chat`,
            type: "chat_message",
            tag: `chat-${matchId}`,
          }),
        }).catch(() => {});
      }
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSelectIcebreaker = (text: string, sendImmediately = false) => {
    if (sendImmediately) {
      sendMessage(text);
    } else {
      setInput(text);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
      }
    }
  };

  const groupedMessages = messages.reduce<
    (Message & { showAvatar: boolean; showName: boolean; isLast: boolean })[]
  >((acc, msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameSenderAsPrev = prev?.sender_id === msg.sender_id;
    const sameSenderAsNext = next?.sender_id === msg.sender_id;
    acc.push({
      ...msg,
      showAvatar: !sameSenderAsNext,
      showName: !sameSenderAsPrev,
      isLast: !sameSenderAsNext,
    });
    return acc;
  }, []);

  const otherProfile = matchData?.otherProfile;
  const partnerProfile = matchData?.partnerProfile;
  const myProfile = matchData?.myProfile;
  const isCouple = otherProfile?.user_type === "couple" && partnerProfile;
  const headerName = isCouple
    ? `${otherProfile?.first_name || "Partner 1"} & ${partnerProfile?.first_name || "Partner 2"}`
    : otherProfile?.first_name || "Your match";

  const distanceKm = calculateDistanceKm(myProfile?.location_city, otherProfile?.location_city);
  const displayScore = matchData?.match?.compatibility_score || 91;

  return (
    <div className="flex h-full w-full bg-[#FAF7F2] overflow-hidden">
      {/* Primary Chat Column */}
      <div className="flex flex-col flex-1 min-w-0 h-full bg-white relative">
        {/* Chat Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-[#EFE8DD] px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 rounded-full text-[#666059] hover:text-[#181513] hover:bg-[#FAF7F2]"
              onClick={() => navigate("/chats")}
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <button
              onClick={() => setMobileInfoOpen(true)}
              className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition-opacity"
            >
              {isCouple ? (
                <div className="flex -space-x-2 shrink-0">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-2xs">
                    {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-primary text-xs font-bold font-serif">
                      {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-10 w-10 border-2 border-white shadow-2xs">
                    {partnerProfile?.avatar_url && <AvatarImage src={partnerProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-primary text-xs font-bold font-serif">
                      {partnerProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <Avatar className="h-10 w-10 border-2 border-white shadow-2xs shrink-0">
                  {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                  <AvatarFallback className="bg-[#FFF0EB] text-primary text-sm font-bold font-serif">
                    {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#181513] truncate font-serif">
                  {headerName}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#666059]">
                  {isOtherUserInChat ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active in chat
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Mutual Match
                    </span>
                  )}
                  {otherProfile?.location_city && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[#888177]">
                      • 📍 {otherProfile.location_city} {distanceKm !== null && `(${distanceKm.toFixed(1)} km)`}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              id="btn-header-icebreaker"
              variant="outline"
              size="sm"
              className={cn(
                "rounded-full h-8 px-3 text-xs font-semibold border-[#FFD5CC] transition-all",
                showIcebreakerCard
                  ? "bg-[#FF5436] text-white hover:bg-[#E03E22]"
                  : "bg-[#FFF5F2] hover:bg-[#FFEAE3] text-[#FF5436]"
              )}
              onClick={() => setShowIcebreakerCard((prev) => !prev)}
              title="Suggest a random lighthearted icebreaker question"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Icebreaker</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs font-semibold border-[#FFD5CC] bg-[#FFF5F2] hover:bg-[#FFEAE3] text-[#FF5436]"
              onClick={() => navigate(`/match-reveal/${matchId}`)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Reveal ({displayScore}%)</span>
              <span className="sm:hidden">{displayScore}%</span>
            </Button>

            {/* Mobile Info Trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 rounded-full text-[#666059] hover:bg-[#FAF7F2]"
              onClick={() => setMobileInfoOpen(true)}
              aria-label="View Profile Info"
            >
              <Info className="h-4 w-4" />
            </Button>

            {/* Block & Report Actions */}
            {matchId && matchData?.otherId && (
              <MatchActions
                matchId={matchId}
                otherUserId={matchData.otherId}
                otherName={otherProfile?.first_name || "Match"}
                onBlocked={() => navigate("/matches")}
              />
            )}
          </div>
        </header>

        {/* Message Feed Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-3 bg-[#FAF7F2]/40">
          {loading ? (
            <div className="space-y-4 pt-4 max-w-xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="h-9 w-9 rounded-full bg-[#EFE8DD] shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-20 rounded bg-[#EFE8DD]" />
                    <div className="h-10 w-48 rounded-2xl bg-[#EFE8DD]" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-4 max-w-md mx-auto my-auto space-y-4">
              <div className="relative">
                <div className="flex -space-x-3 items-center justify-center">
                  <Avatar className="h-14 w-14 border-3 border-white shadow-soft">
                    {myProfile?.avatar_url && <AvatarImage src={myProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-serif font-bold text-base">
                      {myProfile?.first_name?.[0]?.toUpperCase() || "Y"}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-14 w-14 border-3 border-white shadow-soft">
                    {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FAF7F2] text-[#181513] font-serif font-bold text-base border border-[#EBE3D5]">
                      {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#FF5436] p-1 text-white shadow-xs">
                  <Heart className="h-3.5 w-3.5 fill-white" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="font-serif text-xl font-bold text-[#181513]">You're both connected! 🎉</h3>
                <p className="text-xs sm:text-sm text-[#666059] leading-relaxed">
                  Start the conversation by sending a greeting or pick one of the suggestions below to break the ice!
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  id="btn-empty-state-icebreaker"
                  onClick={() => setShowIcebreakerCard(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs px-4 py-2 shadow-soft transition-all active:scale-95"
                >
                  <Sparkles className="h-4 w-4 fill-white" />
                  <span>🎲 Roll an Icebreaker Question</span>
                </Button>
                {QUICK_REPLIES.slice(0, 2).map(({ label, emoji }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(label)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD5CC] bg-white px-3.5 py-2 text-xs font-semibold text-[#181513] shadow-2xs hover:bg-[#FFF5F2] hover:border-[#FF5436] transition-all active:scale-95"
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-2">
              {groupedMessages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const time = format(new Date(msg.created_at), "h:mm a");
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 9, x: isMe ? 8 : -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    layout="position"
                    className={cn(
                      "flex gap-2.5",
                      isMe ? "flex-row-reverse justify-start" : "justify-start",
                      msg.showName && "mt-4"
                    )}
                  >
                    {!isMe && (
                      <div className="w-8 shrink-0 flex items-end">
                        {msg.showAvatar && (
                          <Avatar className="h-8 w-8 border border-[#EBE3D5] shadow-2xs">
                            {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                            <AvatarFallback className="bg-[#FFF0EB] text-primary text-[11px] font-bold">
                              {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div className={cn("max-w-[78%] sm:max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start")}>
                      {!isMe && msg.showName && (
                        <p className="text-[11px] font-bold text-[#888177] mb-1 ml-1.5 text-left">
                          {otherProfile?.first_name || "Match"}
                        </p>
                      )}
                      <div
                        className={cn(
                          "px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words transition-colors",
                          isMe
                            ? "bg-gradient-to-br from-[#FF5436] via-[#FF5F45] to-[#EE3F20] text-white rounded-2xl rounded-br-xs shadow-sm shadow-[#FF5436]/20 font-normal"
                            : "bg-white text-[#191512] border border-[#E7DFD4] rounded-2xl rounded-bl-xs shadow-xs font-normal"
                        )}
                      >
                        {msg.content}
                      </div>
                      {msg.isLast && (
                        <div
                          className={cn(
                            "text-[10px] mt-1 font-medium flex flex-col",
                            isMe ? "items-end mr-1" : "items-start ml-1.5"
                          )}
                        >
                          <div className="flex items-center gap-1 text-[#888177]">
                            <span>{time}</span>
                            {isMe && (
                              (() => {
                                const isRead =
                                  isOtherUserInChat ||
                                  (otherLastReadAt && new Date(otherLastReadAt) >= new Date(msg.created_at));

                                if (isRead) {
                                  return (
                                    <span
                                      className="inline-flex items-center text-[#FF5436] transition-all animate-in fade-in duration-300 ml-0.5"
                                      title={`Seen by match ${
                                        otherLastReadAt
                                          ? "at " + format(new Date(otherLastReadAt), "h:mm a")
                                          : ""
                                      }`}
                                    >
                                      <CheckCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                                    </span>
                                  );
                                }

                                return (
                                  <span
                                    className="inline-flex items-center text-[#9E978D] ml-0.5"
                                    title="Delivered to match"
                                  >
                                    <CheckCheck className="h-3.5 w-3.5 stroke-[2]" />
                                  </span>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Random Lighthearted Icebreaker Suggestion Card */}
        {showIcebreakerCard && (
          <div className="shrink-0 px-3 sm:px-4 pt-3 pb-1 bg-white border-t border-[#FFE5DD]/80">
            <div className="max-w-3xl mx-auto">
              <ChatIcebreakerCard
                matchName={headerName}
                onInsert={(text) => {
                  handleSelectIcebreaker(text, false);
                }}
                onSend={(text) => {
                  sendMessage(text);
                  setShowIcebreakerCard(false);
                }}
                onClose={() => setShowIcebreakerCard(false)}
              />
            </div>
          </div>
        )}

        {/* AI Icebreakers Suggestions */}
        <div className="shrink-0 border-t border-[#EFE8DD] bg-[#FAF7F2]/80 backdrop-blur-xs">
          <AiIcebreakers
            userName={myProfile?.first_name || "You"}
            matchName={headerName}
            city={otherProfile?.location_city || undefined}
            userType={otherProfile?.user_type || undefined}
            onSelectIcebreaker={handleSelectIcebreaker}
          />
        </div>

        {/* Quick Replies Bar */}
        <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto bg-white border-t border-[#EFE8DD] no-scrollbar">
          {QUICK_REPLIES.map(({ label, emoji }) => (
            <button
              key={label}
              onClick={() => sendMessage(label)}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[#EBE3D5] bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-semibold text-[#181513] hover:bg-[#FFF5F2] hover:border-[#FFD5CC] hover:text-[#FF5436] transition-all active:scale-95"
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Bottom Input Field Bar */}
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[#EFE8DD]">
          <div className="max-w-3xl mx-auto flex items-end gap-2 sm:gap-2.5">
            {/* Dedicated Icebreaker Button */}
            <Button
              id="btn-chat-icebreaker"
              type="button"
              variant="outline"
              onClick={() => setShowIcebreakerCard((prev) => !prev)}
              className={cn(
                "h-11 px-3 sm:px-3.5 rounded-2xl font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-2xs active:scale-95",
                showIcebreakerCard
                  ? "bg-[#FF5436] text-white hover:bg-[#E03E22] border-transparent shadow-soft"
                  : "bg-[#FFF5F2] hover:bg-[#FFEAE3] text-[#FF5436] border-[#FFD5CC]"
              )}
              title="Suggest a random lighthearted conversation starter question"
              aria-label="Suggest an icebreaker question"
            >
              <Sparkles className="h-4 w-4 fill-current shrink-0" />
              <span className="font-sans">Icebreaker</span>
            </Button>

            <div className="flex-1 relative rounded-2xl bg-[#FAF7F2] border border-[#EBE3D5] focus-within:border-[#FF5436] focus-within:bg-white transition-all shadow-2xs">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a friendly message… (Enter to send)"
                rows={1}
                className="w-full resize-none bg-transparent px-4 py-3 text-sm text-[#181513] placeholder:text-[#888177] focus:outline-none max-h-32"
              />
            </div>

            <Button
              id="btn-chat-send"
              size="icon"
              className="h-11 w-11 rounded-2xl bg-[#FF5436] hover:bg-[#E03E22] text-white shrink-0 shadow-[0_4px_12px_rgba(255,84,54,0.28)] transition-all active:scale-95 disabled:opacity-50"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Match Profile Sidebar */}
      <aside className="hidden lg:flex flex-col w-[340px] xl:w-[380px] shrink-0 h-full border-l border-[#EFE8DD] bg-[#FAF7F2] overflow-hidden">
        <MatchSidebarProfile
          matchId={matchId!}
          otherProfile={otherProfile}
          partnerProfile={partnerProfile}
          myProfile={myProfile}
          score={displayScore}
        />
      </aside>

      {/* Mobile Profile Slide-over Sheet */}
      <Sheet open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <SheetContent side="right" className="p-0 sm:max-w-md w-full bg-[#FAF7F2]">
          <MatchSidebarProfile
            matchId={matchId!}
            otherProfile={otherProfile}
            partnerProfile={partnerProfile}
            myProfile={myProfile}
            score={displayScore}
            onClose={() => setMobileInfoOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MatchChat;

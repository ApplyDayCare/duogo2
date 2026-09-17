import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageCircle, Info, MapPin, Heart, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
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
  const [isOtherUserInChat, setIsOtherUserInChat] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(() => {
    if (!matchId) return null;
    try {
      return localStorage.getItem(`duogo_chat_partner_last_read_${matchId}`);
    } catch {
      return null;
    }
  });
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportTop, setViewportTop] = useState<number>(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Lock window scroll position on mobile chat so page header never scrolls off-screen
  useEffect(() => {
    if (typeof window === "undefined") return;

    const preventWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener("scroll", preventWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", preventWindowScroll);
    };
  }, []);

  // Monitor mobile visual viewport to shrink layout dynamically when soft keyboard opens
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      const vv = window.visualViewport;
      setViewportHeight(vv.height);
      setViewportTop(vv.offsetTop);

      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange);
        window.visualViewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
    }, 60);
  }, []);

  const handleInputFocus = () => {
    setIsInputFocused(true);
    scrollToBottom(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  const handleDismissKeyboard = () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }
    setIsInputFocused(false);
  };

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

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      for (const recipientId of recipientIds) {
        if (token) {
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
              headers: { Authorization: `Bearer ${token}` },
            })
            .catch(() => {});

          fetch("/api/push/dispatch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
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
    <div
      className="flex h-full w-full bg-[#FAF7F2] overflow-hidden fixed inset-0 lg:static lg:inset-auto"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100dvh",
        top: viewportTop ? `${viewportTop}px` : 0,
      }}
    >
      {/* Primary Chat Column */}
      <div className="flex flex-col flex-1 min-w-0 h-full bg-white relative overflow-hidden">
        {/* Chat Header (Fixed at top) */}
        <header className="bg-white border-b border-[#EFE8DD] px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-2xs z-20 shrink-0 h-13 sm:h-14">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 rounded-full text-[#666059] hover:text-[#181513] hover:bg-[#FAF7F2]"
              onClick={() => navigate("/chats")}
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>

            <button
              onClick={() => setMobileInfoOpen(true)}
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
            >
              {isCouple ? (
                <div className="flex -space-x-2 shrink-0">
                  <Avatar className="h-8 w-8 sm:h-8.5 sm:w-8.5 border-2 border-white shadow-2xs">
                    {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-primary text-[10px] font-bold font-serif">
                      {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-8 w-8 sm:h-8.5 sm:w-8.5 border-2 border-white shadow-2xs">
                    {partnerProfile?.avatar_url && <AvatarImage src={partnerProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-primary text-[10px] font-bold font-serif">
                      {partnerProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <Avatar className="h-8 w-8 sm:h-8.5 sm:w-8.5 border-2 border-white shadow-2xs shrink-0">
                  {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                  <AvatarFallback className="bg-[#FFF0EB] text-primary text-xs font-bold font-serif">
                    {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[13px] sm:text-sm font-bold text-[#181513] truncate font-serif leading-tight">
                  {headerName}
                </p>
                <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-[#666059] leading-tight mt-0.5">
                  {isOtherUserInChat ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 text-[9.5px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
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

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 px-2.5 text-[11px] font-bold border-[#FFD5CC] bg-[#FFF5F2] hover:bg-[#FFEAE3] text-[#FF5436] shrink-0"
              onClick={() => navigate(`/match-reveal/${matchId}`)}
              title={`Compatibility score: ${displayScore}%`}
            >
              <Heart className="h-3 w-3 mr-1 fill-[#FF5436]" />
              <span className="hidden sm:inline">Score </span>
              <span>{displayScore}%</span>
            </Button>

            {/* Mobile Info Trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-7 w-7 rounded-full text-[#666059] hover:bg-[#FAF7F2]"
              onClick={() => setMobileInfoOpen(true)}
              aria-label="View Profile Info"
              title="View Profile Details"
            >
              <Info className="h-3.5 w-3.5" />
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

        {/* Message Feed Area (Scrolls independently taking all remaining height) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-2.5 sm:px-4 py-2 sm:py-3 bg-[#FAF7F2]/40 overscroll-contain"
          onClick={() => {
            if (isInputFocused) handleDismissKeyboard();
          }}
        >
          {loading ? (
            <div className="space-y-3 pt-3 max-w-xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="h-7 w-7 rounded-full bg-[#EFE8DD] shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 w-16 rounded bg-[#EFE8DD]" />
                    <div className="h-8 w-44 rounded-xl bg-[#EFE8DD]" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-3 text-center max-w-sm mx-auto my-auto space-y-3">
              <div className="relative">
                <div className="flex -space-x-2.5 items-center justify-center">
                  <Avatar className="h-11 w-11 border-2 border-white shadow-soft">
                    {myProfile?.avatar_url && <AvatarImage src={myProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FFF0EB] text-[#FF5436] font-serif font-bold text-sm">
                      {myProfile?.first_name?.[0]?.toUpperCase() || "Y"}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-11 w-11 border-2 border-white shadow-soft">
                    {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                    <AvatarFallback className="bg-[#FAF7F2] text-[#181513] font-serif font-bold text-sm border border-[#EBE3D5]">
                      {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#FF5436] p-0.5 text-white shadow-xs">
                  <Heart className="h-3 w-3 fill-white" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-base sm:text-lg font-bold text-[#181513]">You're connected! 🎉</h3>
                <p className="text-[11.5px] sm:text-xs text-[#666059] leading-relaxed max-w-xs mx-auto">
                  Say hello to get your conversation started!
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {QUICK_REPLIES.slice(0, 2).map(({ label, emoji }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(label)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#FFD5CC] bg-white px-3 py-1 text-xs font-semibold text-[#181513] shadow-2xs hover:bg-[#FFF5F2] hover:border-[#FF5436] transition-all active:scale-95"
                  >
                    <span>{emoji}</span>
                    <span className="truncate max-w-[160px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-1">
              {groupedMessages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const time = format(new Date(msg.created_at), "h:mm a");
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6, x: isMe ? 6 : -6 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    layout="position"
                    className={cn(
                      "flex gap-1.5 sm:gap-2",
                      isMe ? "flex-row-reverse justify-start" : "justify-start",
                      msg.showName && "mt-2.5"
                    )}
                  >
                    {!isMe && (
                      <div className="w-8 sm:w-9 shrink-0 flex items-end mb-1">
                        {msg.showAvatar ? (
                          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-[#EBE3D5] shadow-2xs">
                            {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                            <AvatarFallback className="bg-[#FFF0EB] text-primary text-xs font-bold font-serif">
                              {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8 sm:w-9" />
                        )}
                      </div>
                    )}
                    <div className={cn("max-w-[85%] sm:max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start")}>
                      {!isMe && msg.showName && (
                        <p className="text-xs font-bold text-[#7A7368] mb-1 ml-1 text-left">
                          {otherProfile?.first_name || "Match"}
                        </p>
                      )}
                      <div
                        className={cn(
                          "px-4 py-2.5 sm:px-4.5 sm:py-3 text-[15px] sm:text-[15.5px] leading-relaxed whitespace-pre-wrap break-words transition-colors rounded-2xl shadow-2xs",
                          isMe
                            ? cn(
                                "bg-gradient-to-br from-[#FF5436] via-[#FF5F45] to-[#EE3F20] text-white font-normal",
                                msg.isLast ? "rounded-br-xs" : "rounded-r-md"
                              )
                            : cn(
                                "bg-white text-[#191512] border border-[#E7DFD4] font-normal",
                                msg.isLast ? "rounded-bl-xs" : "rounded-l-md"
                              )
                        )}
                      >
                        {msg.content}
                      </div>
                      {msg.isLast && (
                        <div
                          className={cn(
                            "text-[11px] mt-1 font-medium flex items-center gap-1",
                            isMe ? "justify-end mr-0.5 text-[#888177]" : "justify-start ml-1 text-[#888177]"
                          )}
                        >
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
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Fixed Input Area (Fixed at bottom) */}
        <div className="shrink-0 bg-white border-t border-[#EFE8DD] z-20">
          {/* Bottom Input Field Bar */}
          <div className="p-2.5 sm:p-3 max-w-3xl mx-auto flex items-end gap-2 sm:gap-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="flex-1 min-w-0 relative rounded-2xl bg-[#FAF7F2] border border-[#E0D8CB] focus-within:border-[#FF5436] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FF5436]/15 transition-all shadow-2xs">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Type a message…"
                rows={1}
                className="w-full resize-none bg-transparent px-3.5 py-2.5 sm:px-4 sm:py-3 text-[15px] sm:text-base text-[#181513] placeholder:text-[#888177] focus:outline-none min-h-[44px] max-h-32 leading-relaxed"
              />
            </div>

            <Button
              id="btn-chat-send"
              size="icon"
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#FF5436] hover:bg-[#E03E22] text-white shrink-0 shadow-[0_4px_14px_rgba(255,84,54,0.3)] transition-all active:scale-95 disabled:opacity-40"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send className="h-5 w-5 stroke-[2.2]" />
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

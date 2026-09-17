import React, { useEffect } from "react";
import {
  Lock,
  Unlock,
  CheckCircle2,
  MapPin,
  Users,
  User,
  Heart,
  X,
  Check,
  MessageCircle,
} from "lucide-react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  PanInfo,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { getCandidateDisplayName } from "@/lib/matchUtils";
import MatchActions from "@/components/MatchActions";

export interface MatchCardItem {
  user_id: string;
  first_name: string;
  partner_first_name?: string | null;
  user_type: "solo" | "couple";
  location_city?: string | null;
  score: number;
  dimensions?: number[];
  my_dimensions?: number[];
  has_incoming_request?: boolean;
  travel_radius_km?: number | null;
  avatar_url?: string | null;
  partner_avatar_url?: string | null;
  match_id?: string;
  status?: string;
}

export interface MatchCardProps {
  match: MatchCardItem;
  isConnected?: boolean;
  myCity?: string | null;
  candidatePartnerName?: string | null;
  vibes?: { label: string; emoji: string }[];
  userName?: string;
  onConnect?: (match: MatchCardItem) => void;
  onPass?: (match: MatchCardItem) => void;
  onOpenChat?: (matchId: string) => void;
  onBlocked?: (match: MatchCardItem) => void;
  acting?: boolean;
  compact?: boolean;
  className?: string;
  enableSwipe?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  isConnected = false,
  myCity,
  candidatePartnerName,
  vibes = [],
  userName = "You",
  onConnect,
  onPass,
  onOpenChat,
  onBlocked,
  acting = false,
  className = "",
  enableSwipe = true,
}) => {
  const isMutual = isConnected || match.status === "mutual";
  const partnerName = candidatePartnerName || match.partner_first_name;
  const isSwipeable = enableSwipe && !isMutual && Boolean(onConnect || onPass);

  // Framer-motion gesture motion values
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Reset motion values whenever active candidate profile changes
  useEffect(() => {
    x.set(0);
    controls.set({ x: 0, opacity: 1, rotate: 0, scale: 1 });
  }, [match.user_id, match.match_id, controls, x]);

  // Motion transforms for dynamic swipe feedback
  const rotate = useTransform(x, [-260, 0, 260], [-12, 0, 12]);

  // Visual action stamps: CONNECT (dragged right) and PASS (dragged left)
  const connectStampOpacity = useTransform(x, [25, 80], [0, 1]);
  const connectStampScale = useTransform(x, [25, 80], [0.85, 1.05]);

  const passStampOpacity = useTransform(x, [-25, -80], [0, 1]);
  const passStampScale = useTransform(x, [-25, -80], [0.85, 1.05]);

  // Subtle border glow effect during swipe
  const borderHighlight = useTransform(
    x,
    [-120, 0, 120],
    [
      "0 12px 32px rgba(244, 63, 94, 0.18)",
      "0 4px 20px rgba(0, 0, 0, 0.04)",
      "0 12px 32px rgba(16, 185, 129, 0.18)",
    ]
  );

  // Handle drag gesture release
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (acting || !isSwipeable) return;

    const swipeThreshold = 75;
    const velocityThreshold = 280;

    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      // Swiped RIGHT -> Connect / Match
      if (onConnect) {
        controls.start({
          x: 500,
          opacity: 0,
          rotate: 18,
          transition: { duration: 0.2, ease: "easeOut" },
        });
        onConnect(match);
      } else {
        controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
      }
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      // Swiped LEFT -> Pass / Dismiss
      if (onPass) {
        controls.start({
          x: -500,
          opacity: 0,
          rotate: -18,
          transition: { duration: 0.2, ease: "easeOut" },
        });
        onPass(match);
      } else {
        controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
      }
    } else {
      // Snap back smoothly to center
      controls.start({
        x: 0,
        rotate: 0,
        transition: { type: "spring", stiffness: 500, damping: 30 },
      });
    }
  };

  // Programmatic action triggers for button clicks
  const handleButtonPass = () => {
    if (acting) return;
    onPass?.(match);
  };

  const handleButtonConnect = () => {
    if (acting) return;
    onConnect?.(match);
  };

  const revealedName =
    match.user_type === "couple" && partnerName
      ? `${match.first_name} & ${partnerName}`
      : match.first_name || "Community Member";

  const distanceKm = calculateDistanceKm(myCity, match.location_city);

  return (
    <motion.div
      drag={isSwipeable ? "x" : false}
      dragDirectionLock={true}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.82}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 1, x: 0, scale: 1 }}
      animate={controls}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        x,
        rotate: isSwipeable ? rotate : 0,
        boxShadow: isSwipeable ? borderHighlight : undefined,
        touchAction: isSwipeable ? "pan-y" : "auto",
      }}
      className={`relative select-none border transition-all flex flex-col justify-between overflow-hidden ${
        isSwipeable ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        isMutual
          ? "rounded-2xl border-emerald-200/80 bg-gradient-to-b from-white to-[#F9FDFB] shadow-sm hover:shadow-md p-4 sm:p-5"
          : "rounded-[28px] border-[#EFE8DD] bg-white shadow-card p-5 sm:p-6 h-full min-h-[520px]"
      } ${className}`}
    >
      {/* Visual Swipe Stamp: CONNECT */}
      {isSwipeable && (
        <motion.div
          style={{ opacity: connectStampOpacity, scale: connectStampScale }}
          className="pointer-events-none absolute top-6 right-6 z-30 rounded-2xl border-2 border-emerald-500 bg-emerald-500 text-white px-3.5 py-1 shadow-md flex items-center gap-1.5 font-bold text-xs tracking-wider uppercase rotate-12"
        >
          <Check className="h-4 w-4 stroke-[3]" />
          <span>{match.has_incoming_request ? "Match Back" : "Connect"}</span>
        </motion.div>
      )}

      {/* Visual Swipe Stamp: PASS */}
      {isSwipeable && (
        <motion.div
          style={{ opacity: passStampOpacity, scale: passStampScale }}
          className="pointer-events-none absolute top-6 left-6 z-30 rounded-2xl border-2 border-rose-500 bg-rose-500 text-white px-3.5 py-1 shadow-md flex items-center gap-1.5 font-bold text-xs tracking-wider uppercase -rotate-12"
        >
          <X className="h-4 w-4 stroke-[3]" />
          <span>Pass</span>
        </motion.div>
      )}

      {/* Main Content Area - Clean flow without internal scrollbar */}
      <div className={`flex-1 flex flex-col ${isMutual ? "space-y-3 pb-1 justify-start" : "justify-between space-y-3.5 sm:space-y-4 pb-2"}`}>
        {/* Header Badges: Minimal & Clean */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isMutual ? (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 px-3 py-1 text-xs font-semibold gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Connected</span>
              </Badge>
            ) : match.has_incoming_request ? (
              <Badge className="bg-[#FFF0EB] text-primary border-[#FFD9CE] px-3 py-1 text-xs font-bold gap-1.5 animate-pulse">
                <Heart className="h-3.5 w-3.5 fill-[#FF5436]" />
                <span>Sent You a Connection Request</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-[#FAF7F2] border-[#E8E1D5] text-[#706A62] px-3 py-1 text-xs font-medium gap-1.5">
                {match.user_type === "couple" ? (
                  <Users className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{match.user_type === "couple" ? "Duo / Couple Profile" : "Solo Member Profile"}</span>
              </Badge>
            )}

            {match.location_city && (
              <span className="inline-flex items-center gap-1 text-xs text-[#706A62] bg-[#FAF7F2] border border-[#E8E1D5] px-2.5 py-1 rounded-full font-medium">
                <MapPin className="h-3 w-3 text-[#FF5436]" />
                <span>{match.location_city}</span>
                {distanceKm !== null && <span className="text-[#8C847B]">· ~{distanceKm} km</span>}
              </span>
            )}
          </div>

          <div className="shrink-0">
            <MatchActions
              matchId={match.match_id || null}
              otherUserId={match.user_id}
              otherName={match.first_name || "Candidate"}
              onBlocked={() => onBlocked?.(match)}
            />
          </div>
        </div>

        {/* Identity & Visual Avatar */}
        <div className={`flex flex-col items-center text-center ${isMutual ? "pt-1 pb-1" : "pt-2 pb-1"}`}>
          {isMutual ? (
            /* Connected Mode: Reveal Real Avatar & Name */
            <div className="space-y-2 flex flex-col items-center">
              <div className="relative">
                <Avatar className="h-16 w-16 border-2 border-emerald-400 shadow-sm">
                  {match.avatar_url && <AvatarImage src={match.avatar_url} />}
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 font-serif font-bold text-xl">
                    {match.first_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white shadow-xs">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-[#1A1816]">
                  {revealedName}
                </h2>
                <p className="text-xs text-emerald-700 font-medium mt-0.5 flex items-center justify-center gap-1">
                  <Unlock className="h-3 w-3 inline" />
                  <span>First name unlocked • Ready to chat</span>
                </p>
              </div>
            </div>
          ) : (
            /* Candidate Discovery Mode: Minimalist Zero-Bias Persona */
            <div className="space-y-3 flex flex-col items-center w-full">
              {/* Minimalist Aura Ring */}
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#FFF0EB] via-[#FFE4DC] to-[#FFD9CE] border-2 border-[#FFC8B8] flex items-center justify-center text-primary shadow-xs">
                <Heart className="h-8 w-8 fill-[#FF5436] text-[#FF5436]" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1A1816]">
                  {getCandidateDisplayName(match, vibes)}
                </h2>
                <p className="text-xs text-[#706A62] flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3 text-primary inline" />
                  <span>Zero-bias profile • First names unlock on connection</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Shared Vibes Pill Row */}
        {vibes.length > 0 && (
          <div className="pt-1">
            <div className="flex flex-wrap justify-center gap-1.5">
              {vibes.map((v, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#E8E1D5] px-3 py-1 text-xs font-medium text-[#4A453E]"
                >
                  <span>{v.emoji}</span>
                  <span>{v.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls & Gestures (Sticky Footer) */}
      <div className={`shrink-0 border-t ${isMutual ? "pt-3 mt-1.5 border-emerald-100 bg-transparent space-y-0" : "pt-3 sm:pt-4 border-[#F2ECE3] mt-2 bg-white z-10 space-y-2"}`}>
        {isMutual ? (
          <Button
            className="h-10 w-full font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2 text-xs"
            onClick={() => onOpenChat && match.match_id && onOpenChat(match.match_id)}
          >
            <MessageCircle className="h-4 w-4" />
            <span>Open Direct Chat</span>
          </Button>
        ) : (
          <div>
            <div className="flex gap-3">
              {onPass && (
                <Button
                  id="btn-match-pass"
                  variant="outline"
                  className="h-12 sm:h-13 flex-1 text-sm font-bold rounded-2xl border-2 border-[#EFE8DD] bg-white hover:bg-[#FAF7F2] text-[#706A62] hover:text-[#1A1816] transition-all active:scale-98 shadow-xs"
                  disabled={acting}
                  onClick={handleButtonPass}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  <span>Pass</span>
                  <kbd className="hidden lg:inline-block ml-1.5 px-1.5 py-0.5 text-[10px] text-muted-foreground bg-gray-100 rounded border font-mono">P</kbd>
                </Button>
              )}

              {onConnect && (
                <Button
                  id="btn-match-connect"
                  className="h-12 sm:h-13 flex-1 text-sm font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_6px_18px_rgba(255,84,54,0.28)] transition-all active:scale-98"
                  disabled={acting}
                  onClick={handleButtonConnect}
                >
                  {match.has_incoming_request ? (
                    <>
                      <Heart className="mr-1.5 h-4 w-4 fill-white" />
                      <span>Connect Back</span>
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-4 w-4 stroke-[2.5]" />
                      <span>Connect</span>
                    </>
                  )}
                  <kbd className="hidden lg:inline-block ml-1.5 px-1.5 py-0.5 text-[10px] text-white/80 bg-white/20 rounded border border-white/30 font-mono">C</kbd>
                </Button>
              )}
            </div>

            {/* Mobile swipe helper */}
            {isSwipeable && (
              <div className="flex sm:hidden items-center justify-center gap-2 pt-2.5 text-[10px] text-[#8C847B]">
                <span>Swipe left to Pass</span>
                <span>•</span>
                <span>Swipe right to Connect</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MatchCard;

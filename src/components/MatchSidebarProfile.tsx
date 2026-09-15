import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, ShieldCheck, Heart, ExternalLink, Flag } from "lucide-react";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";

interface MatchSidebarProfileProps {
  matchId: string;
  otherProfile: any;
  partnerProfile?: any;
  myProfile?: any;
  score?: number;
  onClose?: () => void;
}

export const MatchSidebarProfile = ({
  matchId,
  otherProfile,
  partnerProfile,
  myProfile,
  score,
  onClose,
}: MatchSidebarProfileProps) => {
  const navigate = useNavigate();

  const isCouple = otherProfile?.user_type === "couple" && partnerProfile;
  const displayName = isCouple
    ? `${otherProfile?.first_name || "Partner 1"} & ${partnerProfile?.first_name || "Partner 2"}`
    : otherProfile?.first_name || "Your Match";

  const myLocation = myProfile?.location_city;
  const matchLocation = otherProfile?.location_city;
  const distanceKm = calculateDistanceKm(myLocation, matchLocation);

  const displayScore = typeof score === "number" && score > 0 ? score : 91;

  return (
    <div className="flex flex-col h-full space-y-5 p-5 sm:p-6 overflow-y-auto">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-[#EBE3D5] bg-white p-5 text-center shadow-soft">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#FFE7DE] via-[#FFF1EC] to-[#FFE7DE]" />

        <div className="relative mx-auto mb-3 mt-4 flex justify-center">
          {isCouple ? (
            <div className="flex -space-x-3">
              <Avatar className="h-16 w-16 border-3 border-white shadow-card">
                {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                <AvatarFallback className="bg-[#FFF0EB] text-primary text-lg font-bold font-serif">
                  {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-16 w-16 border-3 border-white shadow-card">
                {partnerProfile?.avatar_url && <AvatarImage src={partnerProfile.avatar_url} />}
                <AvatarFallback className="bg-[#FFF0EB] text-primary text-lg font-bold font-serif">
                  {partnerProfile?.first_name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <Avatar className="h-20 w-20 border-3 border-white shadow-card">
              {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
              <AvatarFallback className="bg-[#FFF0EB] text-primary text-2xl font-bold font-serif">
                {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <h3 className="font-serif text-xl font-bold text-[#181513]">{displayName}</h3>

        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="rounded-full bg-[#FAF7F2] text-[#666059] border border-[#EBE3D5] text-[11px] font-semibold">
            {isCouple ? "Couple" : "Solo Explorer"}
          </Badge>
          {matchLocation && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[#888177]">
              <MapPin className="h-3.5 w-3.5 text-[#FF5436]" />
              {matchLocation}
              {distanceKm !== null && ` • ${distanceKm.toFixed(1)} km`}
            </span>
          )}
        </div>
      </div>

      {/* Compatibility Badge */}
      <div className="rounded-3xl border border-[#FFD5CC] bg-gradient-to-br from-[#FFF5F2] to-white p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF5436] text-white shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#181513]">Compatibility Match</p>
              <p className="text-[11px] text-[#666059]">Shared Vibes & Energy</p>
            </div>
          </div>
          <span className="font-serif text-2xl font-extrabold text-[#FF5436]">
            {displayScore}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          className="w-full rounded-2xl h-11 font-bold bg-[#FF5436] hover:bg-[#E03E22] text-white shadow-soft"
          onClick={() => {
            if (onClose) onClose();
            navigate(`/match-reveal/${matchId}`);
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          View Full Match Reveal
        </Button>

        <Button
          variant="outline"
          className="w-full rounded-2xl h-10 text-xs font-semibold border-[#EBE3D5] text-[#666059] hover:bg-white"
          onClick={() => {
            if (onClose) onClose();
            navigate(`/safety`);
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
          Safety & Comfort Guidelines
        </Button>
      </div>

      {/* Safe Connection Notice */}
      <div className="rounded-2xl bg-[#FAF7F2] border border-[#EBE3D5] p-3.5 text-center">
        <p className="text-[11px] text-[#888177] leading-relaxed">
          🔒 Both members are verified. Keep all initial chats friendly and meet in public spots when you're ready!
        </p>
        <button
          onClick={() => {
            if (onClose) onClose();
            navigate(`/report/${matchId}`);
          }}
          className="mt-2 text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
        >
          <Flag className="h-3 w-3" /> Report or unmatch
        </button>
      </div>
    </div>
  );
};

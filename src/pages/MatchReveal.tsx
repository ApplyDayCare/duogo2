import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCouplePartnerId, resolveOtherId } from "@/lib/coupleUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, PartyPopper, MapPin, ExternalLink, Mail, Search, Home, Flag, MessageCircle } from "lucide-react";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { MatchSynergyCard } from "@/components/MatchSynergyCard";
import { soloScore, QuizRow } from "@/lib/scoring";

interface MatchProfile {
  first_name: string | null;
  location_city: string | null;
  social_link: string | null;
  user_type: string | null;
  avatar_url: string | null;
}

const MatchReveal = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["match-reveal", matchId],
    queryFn: async () => {
      // Fetch match record
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId!)
        .single();

      if (!match) throw new Error("Match not found");

      // Auto-heal status to mutual if both parties accepted
      if (match.user_a_action === "accept" && match.user_b_action === "accept" && match.status !== "mutual") {
        await supabase
          .from("matches")
          .update({ status: "mutual", revealed_at: new Date().toISOString() })
          .eq("id", match.id);
        match.status = "mutual";
      }

      // Resolve other side: handles couple partner viewing
      const myPartnerId = await getCouplePartnerId(user!.id);
      const otherId = resolveOtherId(match, user!.id, myPartnerId);

      // Get current user profile for distance comparison
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("location_city")
        .eq("id", user!.id)
        .maybeSingle();

      // Get other user's profile
      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("first_name, location_city, social_link, user_type, avatar_url")
        .eq("id", otherId)
        .single();

      // If it's a couple match, get the partner's profile too
      let partnerProfile: MatchProfile | null = null;
      if (otherProfile?.user_type === "couple") {
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${otherId},partner_b_id.eq.${otherId}`)
          .maybeSingle();

        if (couple) {
          const partnerId = couple.partner_a_id === otherId ? couple.partner_b_id : couple.partner_a_id;
          if (partnerId) {
            const { data: pp } = await supabase
              .from("profiles")
              .select("first_name, location_city, social_link, user_type, avatar_url")
              .eq("id", partnerId)
              .single();
            partnerProfile = pp;
          }
        }
      }

      let score = Number(match.compatibility_score) || 0;
      if (score <= 0) {
        try {
          const { data: qResponses } = await supabase
            .from("quiz_responses")
            .select("*")
            .in("user_id", [user!.id, otherId]);

          if (qResponses && qResponses.length >= 2) {
            const qMy = qResponses.find((q) => q.user_id === user!.id) as QuizRow | undefined;
            const qOther = qResponses.find((q) => q.user_id === otherId) as QuizRow | undefined;
            if (qMy && qOther) {
              score = soloScore(qMy, qOther);
              // Save the computed compatibility score to the match record
              await supabase
                .from("matches")
                .update({ compatibility_score: score })
                .eq("id", match.id);
            }
          }
        } catch (err) {
          console.warn("Failed to compute compatibility score fallback:", err);
        }
      }

      return { match, otherProfile, partnerProfile, myProfile, score };
    },
    enabled: !!user && !!matchId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.match || data.match.status !== "mutual") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <p className="text-muted-foreground mb-4">Match not found or not yet mutual.</p>
        <Button onClick={() => navigate("/matches")}>Back to Matches</Button>
      </div>
    );
  }

  const { otherProfile, partnerProfile, myProfile, score } = data;
  const isCouple = otherProfile?.user_type === "couple" && partnerProfile;
  const distanceKm = calculateDistanceKm(myProfile?.location_city, otherProfile?.location_city);
  const isWithin5 = distanceKm !== null && distanceKm <= 5.0;

  const renderSocialLink = (link: string | null, name: string | null) => {
    if (!link) return null;
    const url = link.startsWith("http") ? link : `https://${link}`;
    // Extract display label from URL
    const label = link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label || name || "Profile"}
      </a>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-6">
        <Card className="rounded-[32px] border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
          {/* Celebratory Hero Gradient Header */}
          <div className="relative bg-gradient-to-br from-[#FF5436] via-[#FF6A50] to-[#E84326] p-8 text-white text-center">
            <div className="relative z-10 space-y-3">
              {isCouple ? (
                <div className="flex justify-center -space-x-3">
                  <Avatar className="h-20 w-20 border-4 border-white shadow-md">
                    {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                    <AvatarFallback className="bg-white text-primary text-xl font-bold font-serif">
                      {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-20 w-20 border-4 border-white shadow-md">
                    {partnerProfile?.avatar_url && <AvatarImage src={partnerProfile.avatar_url} />}
                    <AvatarFallback className="bg-white text-primary text-xl font-bold font-serif">
                      {partnerProfile?.first_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <Avatar className="mx-auto h-24 w-24 border-4 border-white shadow-lg">
                  {otherProfile?.avatar_url && <AvatarImage src={otherProfile.avatar_url} />}
                  <AvatarFallback className="bg-white text-primary text-3xl font-bold font-serif">
                    {otherProfile?.first_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-white tracking-wide">
                  <PartyPopper className="h-3.5 w-3.5" />
                  <span>Mutual Connection</span>
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  It's a Match! 🎉
                </h1>
                <p className="text-sm font-medium text-white/90">
                  {Math.round(Number(score))}% Shared Vibe & Energy
                </p>
              </div>
            </div>
          </div>

          <CardContent className="space-y-6 p-6 sm:p-8">
            {/* Match details card */}
            <div className="rounded-2xl bg-[#FAF7F2] p-5 border border-[#EFE8DD] space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">You matched with:</p>

              {isCouple ? (
                <div className="space-y-3">
                  <p className="font-serif text-xl font-bold text-foreground">
                    {otherProfile?.first_name || "Partner 1"} & {partnerProfile?.first_name || "Partner 2"}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Connected Profiles:</p>
                    <div className="flex flex-col gap-1.5">
                      {otherProfile?.social_link && (
                        <div className="flex items-center gap-2 text-sm">
                          {renderSocialLink(otherProfile.social_link, otherProfile.first_name)}
                        </div>
                      )}
                      {partnerProfile?.social_link && (
                        <div className="flex items-center gap-2 text-sm">
                          {renderSocialLink(partnerProfile.social_link, partnerProfile.first_name)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-serif text-xl font-bold text-foreground">
                    {otherProfile?.first_name || "Your match"}
                  </p>
                  {otherProfile?.social_link && (
                    <div className="text-sm">
                      {renderSocialLink(otherProfile.social_link, otherProfile.first_name)}
                    </div>
                  )}
                </div>
              )}

              {otherProfile?.location_city && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>Based in {otherProfile.location_city}</span>
                    </span>
                    {distanceKm !== null && (
                      <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                        isWithin5 
                          ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]" 
                          : "text-muted-foreground"
                      }`}>
                        {isWithin5 ? `Within 5 km (~${distanceKm} km)` : `~${distanceKm} km away`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Gemini AI Synergy Breakdown */}
            <MatchSynergyCard
              userName={myProfile?.first_name || "You"}
              matchName={
                isCouple
                  ? `${otherProfile?.first_name || "Partner 1"} & ${partnerProfile?.first_name || "Partner 2"}`
                  : otherProfile?.first_name || "Your Match"
              }
              city={otherProfile?.location_city || myProfile?.location_city || undefined}
              score={Math.round(Number(score))}
            />

            {/* In-App Chat Notice */}
            <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-primary font-bold text-sm">
                <MessageCircle className="h-4 w-4" />
                <span>In-App Chat is Now Open!</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can now message each other directly inside the app, and we've sent an intro email to coordinate details.
              </p>
            </div>

            {/* What's next tips */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How to get the vibe going:</p>
              <div className="space-y-2 text-xs font-medium text-foreground">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-[#EFE8DD]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0EB] text-[11px] font-bold text-primary">1</span>
                  <span>Say hi in the in-app chat with a quick question</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-[#EFE8DD]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0EB] text-[11px] font-bold text-primary">2</span>
                  <span>Find common ground from your shared vibes</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-[#EFE8DD]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0EB] text-[11px] font-bold text-primary">3</span>
                  <span>Pick a public spot for coffee, drinks, or brunch!</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                className="h-13 w-full text-base font-bold rounded-full shadow-[0_6px_20px_rgba(255,84,54,0.35)]"
                onClick={() => navigate(`/match/${matchId}/chat`)}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Start Chatting with {otherProfile?.first_name || "Your Match"}
              </Button>
              <Button
                variant="secondary"
                className="h-11 w-full text-sm font-semibold rounded-full hover:bg-secondary/80"
                onClick={() => navigate("/matches")}
              >
                <Search className="mr-2 h-4 w-4" />
                Find Another Match
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full text-sm font-semibold rounded-full"
                onClick={() => navigate("/dashboard")}
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => navigate(`/report/${matchId}`)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
              >
                <Flag className="h-3 w-3" /> Report or unmatch this user
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatchReveal;

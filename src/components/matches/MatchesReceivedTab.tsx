import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Handshake, ChevronLeft, ChevronRight, Sparkles, ShieldCheck } from "lucide-react";
import { MatchCard } from "@/components/MatchCard";
import { CompatibilityScoreMeter } from "@/components/CompatibilityScoreMeter";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import type { MatchData } from "@/lib/matchEngine";

interface MatchesReceivedTabProps {
  incomingMatches: MatchData[];
  currentReceivedMatch: MatchData | undefined;
  receivedIndex: number;
  setReceivedIndex: React.Dispatch<React.SetStateAction<number>>;
  receivedVibes: Array<{ label: string; emoji: string }>;
  userType?: string;
  locationCity?: string;
  acting: boolean;
  handleAction: (match: MatchData, action: "accept" | "pass") => void;
  onDiscoverClick: () => void;
}

export const MatchesReceivedTab = ({
  incomingMatches,
  currentReceivedMatch,
  receivedIndex,
  setReceivedIndex,
  receivedVibes,
  userType,
  locationCity,
  acting,
  handleAction,
  onDiscoverClick,
}: MatchesReceivedTabProps) => {
  if (incomingMatches.length === 0) {
    return (
      <div className="flex-1 pt-1 space-y-4">
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary mb-3 mx-auto">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Incoming Requests Right Now</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            When compatible members discover your profile and send a connection request, they will appear here so you can connect back with a single click.
          </p>
          <Button
            onClick={onDiscoverClick}
            className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Explore Discover Queue
          </Button>
        </Card>
      </div>
    );
  }

  if (!currentReceivedMatch) return null;

  const radarData = [
    { subject: "Social Energy", you: currentReceivedMatch.my_dimensions[0] || 3, candidate: currentReceivedMatch.dimensions[0] || 3 },
    { subject: "Budget", you: currentReceivedMatch.my_dimensions[1] || 3, candidate: currentReceivedMatch.dimensions[1] || 3 },
    { subject: "Spontaneity", you: currentReceivedMatch.my_dimensions[2] || 3, candidate: currentReceivedMatch.dimensions[2] || 3 },
    { subject: "Planning", you: currentReceivedMatch.my_dimensions[3] || 3, candidate: currentReceivedMatch.dimensions[3] || 3 },
    { subject: "Intellectual", you: currentReceivedMatch.my_dimensions[4] || 3, candidate: currentReceivedMatch.dimensions[4] || 3 },
    { subject: "Activity", you: currentReceivedMatch.my_dimensions[5] || 3, candidate: currentReceivedMatch.dimensions[5] || 3 },
    { subject: "Alcohol/Night", you: currentReceivedMatch.my_dimensions[6] || 3, candidate: currentReceivedMatch.dimensions[6] || 3 },
    { subject: "Humor", you: currentReceivedMatch.my_dimensions[7] || 3, candidate: currentReceivedMatch.dimensions[7] || 3 },
    { subject: "Commitment", you: currentReceivedMatch.my_dimensions[8] || 3, candidate: currentReceivedMatch.dimensions[8] || 3 },
    { subject: "Home/Private", you: currentReceivedMatch.my_dimensions[9] || 3, candidate: currentReceivedMatch.dimensions[9] || 3 },
  ];

  return (
    <div className="flex-1 pt-1 space-y-4">
      <div className="space-y-4 pb-8 flex-1 flex flex-col min-h-0">
        {/* Stepper Navigation Bar when reviewing incoming requests */}
        <div className="flex items-center justify-between px-1 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Handshake className="h-4 w-4 text-primary" />
              <span>Request {Math.min(receivedIndex + 1, incomingMatches.length)} of {incomingMatches.length}</span>
            </span>
            <Badge variant="outline" className="bg-[#FFF4F0] border-[#FFD9CE] text-primary font-semibold text-[10px] py-0.5">
              Awaiting Your Response
            </Badge>
          </div>

          {incomingMatches.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full border-[#EFE8DD] hover:bg-[#FFF0EB] text-foreground disabled:opacity-30"
                disabled={receivedIndex <= 0}
                onClick={() => setReceivedIndex((prev) => Math.max(0, prev - 1))}
                title="Previous request"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium px-1">
                {receivedIndex + 1} / {incomingMatches.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full border-[#EFE8DD] hover:bg-[#FFF0EB] text-foreground disabled:opacity-30"
                disabled={receivedIndex >= incomingMatches.length - 1}
                onClick={() => setReceivedIndex((prev) => Math.min(incomingMatches.length - 1, prev + 1))}
                title="Next request"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Single Focused Request View with Compatibility Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* LEFT COLUMN: Modular MatchCard with Connect Back & Pass */}
          <div className="lg:col-span-5 flex flex-col relative">
            <MatchCard
              key={currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}
              match={currentReceivedMatch}
              isConnected={false}
              myCity={locationCity}
              candidatePartnerName={undefined}
              vibes={receivedVibes}
              userName={userType === "couple" ? "Your Duo" : "You"}
              onConnect={() => {
                handleAction(currentReceivedMatch, "accept");
              }}
              onPass={() => {
                handleAction(currentReceivedMatch, "pass");
              }}
              acting={acting}
              enableSwipe={false}
              className="w-full"
            />
          </div>

          {/* RIGHT COLUMN: Compatibility Breakdown for this Candidate */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <CompatibilityScoreMeter
              key={`received-score-meter-${currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}`}
              myDimensions={currentReceivedMatch.my_dimensions}
              candidateDimensions={currentReceivedMatch.dimensions}
              fallbackScore={currentReceivedMatch.score}
            />

            {/* Compatibility Dimensions Radar Chart */}
            <div
              key={`received-radar-${currentReceivedMatch.pending_match_id || currentReceivedMatch.user_id}`}
              className="rounded-[28px] border border-[#EFE8DD] shadow-card bg-white p-4 sm:p-5"
            >
              <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1A1816]">Compatibility Dimensions</h3>
                  <p className="text-[11px] text-muted-foreground">Overlap across 5 core social pacing dimensions</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5436]" />
                    <span className="text-[#1A1816]">{userType === "couple" ? "Your Duo" : "You"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                    <span className="text-[#1A1816] flex items-center gap-1">
                      <span>Candidate</span>
                      <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[220px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#EFE8DD" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#706A62", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="You" dataKey="you" stroke="#FF5436" fill="#FF5436" fillOpacity={0.25} />
                    <Radar name="Candidate" dataKey="candidate" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

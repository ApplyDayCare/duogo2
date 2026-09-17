import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, CheckCircle2, Share2, WifiOff, ShieldCheck } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { MatchCard } from "@/components/MatchCard";
import { CompatibilityScoreMeter } from "@/components/CompatibilityScoreMeter";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import type { MatchData } from "@/lib/matchEngine";

interface MatchesDiscoverTabProps {
  currentMatch: MatchData | undefined;
  matchesListCount: number;
  pendingCount: number;
  connectedCount: number;
  isOffline: boolean;
  userType?: string;
  locationCity?: string;
  vibes: Array<{ label: string; emoji: string }>;
  radarData: Array<{ dimension: string; You: number; Match: number }>;
  acting: boolean;
  handleAction: (match: MatchData, action: "accept" | "pass") => void;
  onBlocked: () => void;
  onResetPassed: () => void;
  onNavigate: (path: string) => void;
  onSwitchTab: (tab: "pending" | "connected") => void;
}

export const MatchesDiscoverTab = ({
  currentMatch,
  matchesListCount,
  pendingCount,
  connectedCount,
  isOffline,
  userType,
  locationCity,
  vibes,
  radarData,
  acting,
  handleAction,
  onBlocked,
  onResetPassed,
  onNavigate,
  onSwitchTab,
}: MatchesDiscoverTabProps) => {
  if (!currentMatch) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
          <div className="bg-gradient-to-b from-[#FFF5F1] to-white p-8 text-center border-b border-[#F5EDE3]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EB] text-3xl shadow-xs mb-3">
              {pendingCount > 0 ? "🕒" : "✨"}
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              {pendingCount > 0 ? "All Caught Up in Discovery!" : "Curating Your Circle"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              {pendingCount > 0
                ? `You've reviewed all available candidates. You currently have ${pendingCount} pending connection request(s) awaiting response!`
                : "We match you based on deep compatibility, not an endless swipe stack. We'll notify you as new verified members join!"}
            </p>
          </div>

          <CardContent className="space-y-4 p-6 text-center">
            {pendingCount > 0 && (
              <Button
                className="rounded-full h-11 w-full font-semibold bg-amber-500 hover:bg-amber-600 text-white text-xs"
                onClick={() => onSwitchTab("pending")}
              >
                <Clock className="h-4 w-4 mr-2" />
                View Pending Requests ({pendingCount})
              </Button>
            )}

            {connectedCount > 0 && (
              <Button
                variant="outline"
                className="rounded-full h-11 w-full font-semibold border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 text-xs"
                onClick={() => onSwitchTab("connected")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                View Connected Matches ({connectedCount})
              </Button>
            )}

            <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Priority Match Booster</p>
              <p className="text-xs text-foreground mt-1 font-medium leading-relaxed">
                Invite a friend and unlock <strong>7 days of Priority Matching</strong> as soon as they sign up!
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                variant="outline"
                className="rounded-full h-11 w-full font-bold border-[#FF5436]/40 text-[#FF5436] hover:bg-[#FFF0EB]"
                onClick={onResetPassed}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Re-review Passed Candidates
              </Button>
              <Button className="rounded-full h-12 w-full font-bold" onClick={() => onNavigate("/referral")}>
                <Share2 className="h-4 w-4 mr-2" /> Share Your Referral Link
              </Button>
              <Button variant="outline" className="rounded-full h-12 w-full font-semibold" onClick={() => onNavigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 flex-1 flex flex-col">
      {/* Discovery status bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Candidate 1 of {matchesListCount}</span>
          </span>
          {isOffline ? (
            <span
              id="offline-sync-indicator"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
              title="Displaying cached compatibility queue"
            >
              <WifiOff className="h-2.5 w-2.5 text-amber-600" />
              <span>Offline Cache</span>
            </span>
          ) : (
            <span
              id="live-sync-indicator"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
              title="Compatibility queue updated dynamically"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}
        </div>
        <span className="text-[11px] hidden sm:inline">Swipe card or press C (Connect) / P (Pass)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* LEFT COLUMN: Modular MatchCard Component & Action Controls */}
        <div className="lg:col-span-5 flex flex-col relative">
          <AnimatePresence mode="popLayout">
            <MatchCard
              key={currentMatch.user_id}
              match={currentMatch}
              isConnected={false}
              myCity={locationCity}
              candidatePartnerName={undefined}
              vibes={vibes}
              userName={userType === "couple" ? "Your Duo" : "You"}
              onConnect={() => handleAction(currentMatch, "accept")}
              onPass={() => handleAction(currentMatch, "pass")}
              onBlocked={onBlocked}
              acting={acting}
              className="w-full"
            />
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: CompatibilityScoreMeter on Top + Dimensions Radar Below */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <CompatibilityScoreMeter
            key={`score-meter-${currentMatch.user_id}`}
            myDimensions={currentMatch.my_dimensions}
            candidateDimensions={currentMatch.dimensions}
            fallbackScore={currentMatch.score}
          />

          {/* Compatibility Dimensions Radar Chart */}
          <div
            key={`radar-${currentMatch.user_id}`}
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

            <div className="h-[200px] sm:h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="#E0D6CA" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fontSize: 11, fill: "#5C5752", fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    tick={{ fontSize: 8, fill: "#8C847B" }}
                  />
                  <Radar
                    name="You"
                    dataKey="You"
                    stroke="#FF5436"
                    fill="#FF5436"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Match"
                    dataKey="Match"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles, Lock } from "lucide-react";
import { calculateDistanceKm } from "@/lib/postalCodeUtils";
import { getTopSharedVibes, getCandidateDisplayName, sanitizeLocationCity } from "@/lib/matchUtils";
import type { MatchData } from "@/lib/matchEngine";

interface MatchesPendingTabProps {
  pendingMatches: MatchData[];
  myCity?: string;
  onDiscoverClick: () => void;
}

export const MatchesPendingTab = ({
  pendingMatches,
  myCity,
  onDiscoverClick,
}: MatchesPendingTabProps) => {
  return (
    <div className="flex-1 overflow-y-auto pt-2 space-y-4">
      <div className="rounded-2xl bg-[#FFF9F6] border border-[#FFD9CE] p-3.5 text-xs text-[#7A3E2D] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span>
            <strong>Pending Requests:</strong> Awaiting candidate response. First names and direct chat unlock upon mutual acceptance.
          </span>
        </div>
        <Badge variant="outline" className="bg-white border-[#FFD9CE] text-primary font-bold text-xs">
          {pendingMatches.length} Sent
        </Badge>
      </div>

      {pendingMatches.length === 0 ? (
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-primary mb-3 mx-auto">
            <Clock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Pending Requests</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            When you send a connection request to candidates in Discover, you can track candidate response status right here.
          </p>
          <Button
            onClick={onDiscoverClick}
            className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Discover Candidates
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          {pendingMatches.map((m) => {
            const mDist = calculateDistanceKm(myCity, m.location_city);
            const mVibes = getTopSharedVibes(m.my_dimensions, m.dimensions);
            return (
              <Card key={m.user_id} className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-[#FFF9F6] border-[#FFD9CE] text-[#7A3E2D] font-bold text-xs flex items-center gap-1.5 py-1">
                    <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                    <span>Awaiting Candidate Response</span>
                  </Badge>
                  <div className="inline-flex items-center rounded-2xl bg-[#FFF4F0] border border-[#FCD9CE] px-2.5 py-0.5">
                    <span className="text-lg font-bold text-primary mr-1 font-serif">{Math.round(m.score)}%</span>
                    <span className="text-[10px] font-semibold text-primary">Vibe</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#FFF0EB] to-[#FFE4DC] border border-[#FFC8B8] flex items-center justify-center text-primary shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-foreground">
                      {getCandidateDisplayName(m, mVibes)}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 text-primary inline" />
                      <span>Names unlock once candidate accepts</span>
                    </p>
                  </div>
                </div>

                {mVibes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mVibes.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#FAF7F2] border border-[#EFE8DD] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">
                        <span>{v.emoji}</span>
                        <span>{v.label}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl bg-[#FAF7F2] p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Location</span>
                    <span className="font-bold text-foreground">{sanitizeLocationCity(m.location_city)}</span>
                  </div>
                  {mDist !== null && (
                    <div className="flex justify-between">
                      <span>Distance</span>
                      <span className="font-bold text-foreground">~{mDist} km away</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

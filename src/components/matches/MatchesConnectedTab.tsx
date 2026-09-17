import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { MatchCard, MatchCardItem } from "@/components/MatchCard";

interface MatchesConnectedTabProps {
  connectedMatches: MatchCardItem[];
  myCity?: string;
  onDiscoverClick: () => void;
  onOpenChat: (matchId: string) => void;
}

export const MatchesConnectedTab = ({
  connectedMatches,
  myCity,
  onDiscoverClick,
  onOpenChat,
}: MatchesConnectedTabProps) => {
  return (
    <div className="flex-1 overflow-y-auto pt-2">
      {connectedMatches.length === 0 ? (
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white p-8 text-center max-w-md mx-auto my-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-emerald-600 mb-3 mx-auto">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground mb-1.5">No Connected Matches Yet</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            When you and another member accept each other, the connection is established and their real first name, profile, and chat will unlock right here!
          </p>
          <Button
            onClick={onDiscoverClick}
            className="rounded-full font-bold bg-[#FF5436] hover:bg-[#E84326] text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Discover Candidate Vibes
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 text-xs text-[#065F46] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Mutual Connections Established:</strong> First names and verified profiles are fully unlocked for your confirmed matches.
              </span>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold">{connectedMatches.length} Connected</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {connectedMatches.map((m) => (
              <MatchCard
                key={m.match_id || m.user_id}
                match={m}
                isConnected={true}
                myCity={myCity}
                onOpenChat={onOpenChat}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Coffee, CheckCircle2 } from "lucide-react";
import { fetchMatchSynergy, MatchSynergyData } from "@/lib/geminiApi";

interface MatchSynergyCardProps {
  userName?: string;
  matchName: string;
  sharedVibes?: string[];
  city?: string;
  score?: number;
  dimensionDetails?: string[];
  compact?: boolean;
  className?: string;
}

export const MatchSynergyCard = ({
  userName = "You",
  matchName,
  sharedVibes = [],
  city,
  score,
  dimensionDetails,
  compact = false,
  className = "",
}: MatchSynergyCardProps) => {
  const [synergy, setSynergy] = useState<MatchSynergyData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSynergy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMatchSynergy({
        userName,
        matchName,
        sharedVibes,
        city,
        score,
        dimensionDetails,
      });
      setSynergy(data);
    } finally {
      setLoading(false);
    }
  }, [userName, matchName, sharedVibes, city, score, dimensionDetails]);

  useEffect(() => {
    loadSynergy();
  }, [loadSynergy]);

  return (
    <div
      id="match-synergy-summary"
      className={`rounded-2xl bg-gradient-to-br from-[#FFF9F6] to-[#FFF1EB] border border-[#FFD9CE] shadow-xs ${
        compact ? "p-3.5 space-y-2.5" : "p-4 space-y-3"
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-xs font-serif font-bold text-foreground leading-tight">
          Why You Two Click
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2 py-0.5 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-primary/10" />
          <div className="h-3 w-full rounded bg-[#EFE8DD]" />
          <div className="h-3 w-5/6 rounded bg-[#EFE8DD]" />
          <div className="pt-0.5 space-y-1">
            <div className="h-2.5 w-2/3 rounded bg-[#EFE8DD]" />
          </div>
        </div>
      ) : synergy ? (
        <div className="space-y-2 text-xs">
          {/* Headline */}
          <div className="rounded-xl bg-white/90 border border-[#FFD9CE]/60 px-2.5 py-1">
            <p className="font-serif font-bold text-xs text-foreground">
              ✨ "{synergy.headline}"
            </p>
          </div>

          {/* Conversational Explanation */}
          <p className="text-foreground/90 leading-relaxed font-normal text-xs">
            {synergy.summary}
          </p>

          {/* Key Strengths */}
          {synergy.sharedStrengths?.length > 0 && (
            <div className="space-y-1 pt-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Key Shared Traits:
              </p>
              <div className="grid grid-cols-1 gap-1">
                {synergy.sharedStrengths.map((strength, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-foreground/85 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="leading-tight">{strength}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Activity */}
          {synergy.recommendedActivity && (
            <div className="rounded-xl bg-white/90 border border-[#FFD9CE] p-2.5 flex items-start gap-2">
              <Coffee className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-bold text-[10px] text-primary uppercase tracking-wide block">
                  Suggested First Meetup:
                </span>
                <span className="text-foreground font-medium text-[11px] leading-snug">
                  {synergy.recommendedActivity}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

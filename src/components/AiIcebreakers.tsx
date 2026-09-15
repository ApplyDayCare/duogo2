import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Send, MessageSquarePlus } from "lucide-react";
import { fetchMatchIcebreakers } from "@/lib/geminiApi";

interface AiIcebreakersProps {
  userName?: string;
  matchName: string;
  sharedVibes?: string[];
  city?: string;
  userType?: string;
  onSelectIcebreaker: (text: string, sendImmediately?: boolean) => void;
}

export const AiIcebreakers = ({
  userName = "You",
  matchName,
  sharedVibes = [],
  city,
  userType,
  onSelectIcebreaker,
}: AiIcebreakersProps) => {
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadIcebreakers = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchMatchIcebreakers({
        userName,
        matchName,
        sharedVibes,
        city,
        userType,
      });
      setIcebreakers(items);
    } finally {
      setLoading(false);
    }
  }, [userName, matchName, sharedVibes, city, userType]);

  useEffect(() => {
    loadIcebreakers();
  }, [loadIcebreakers]);

  return (
    <div
      id="ai-icebreakers-container"
      className="bg-[#FFF9F6] border-t border-b border-[#FFD9CE] px-4 py-2.5 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold text-primary tracking-wide">
            Suggested Icebreakers
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            • Tap to use in chat
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-refresh-icebreakers"
            onClick={loadIcebreakers}
            disabled={loading}
            title="Generate new conversation starters"
            className="text-[11px] text-muted-foreground hover:text-primary px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden xs:inline">New Ideas</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
          >
            {isExpanded ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-0.5">
          {loading ? (
            <div className="flex gap-2 w-full">
              <div className="h-8 w-48 rounded-full bg-[#EFE8DD] animate-pulse shrink-0" />
              <div className="h-8 w-56 rounded-full bg-[#EFE8DD] animate-pulse shrink-0" />
            </div>
          ) : (
            icebreakers.map((text, idx) => (
              <div
                key={idx}
                className="group shrink-0 flex items-center bg-white border border-[#FFD9CE] hover:border-primary/60 rounded-2xl shadow-2xs transition-all hover:bg-[#FFF4F0] max-w-[280px] sm:max-w-xs"
              >
                <button
                  onClick={() => onSelectIcebreaker(text, false)}
                  className="px-3 py-1.5 text-left text-xs text-foreground group-hover:text-primary leading-tight font-medium flex items-center gap-1.5"
                  title="Insert into text box"
                >
                  <MessageSquarePlus className="h-3 w-3 text-primary shrink-0 opacity-70 group-hover:opacity-100" />
                  <span className="truncate">{text}</span>
                </button>
                <button
                  onClick={() => onSelectIcebreaker(text, true)}
                  className="px-2 py-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-r-2xl border-l border-[#FFD9CE]/60 transition-colors shrink-0"
                  title="Send immediately"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

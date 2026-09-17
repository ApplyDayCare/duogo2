import { useState } from "react";
import { Shuffle, Send, MessageSquarePlus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomIcebreaker, IcebreakerQuestion } from "@/data/icebreakers";
import { cn } from "@/lib/utils";

const QUICK_REPLIES = [
  { label: "Hey! Excited to connect", emoji: "👋" },
  { label: "Want to meet up for coffee?", emoji: "☕" },
  { label: "What neighborhood are you in?", emoji: "📍" },
  { label: "What are your favorite weekend spots?", emoji: "✨" },
];

interface ChatStartersPanelProps {
  matchName: string;
  userName?: string;
  city?: string;
  userType?: string;
  onSelect: (text: string, sendImmediately?: boolean) => void;
  onClose: () => void;
}

export const ChatStartersPanel = ({
  matchName,
  onSelect,
  onClose,
}: ChatStartersPanelProps) => {
  const [activeTab, setActiveTab] = useState<"question" | "quick">("question");
  const [currentQuestion, setCurrentQuestion] = useState<IcebreakerQuestion>(() => getRandomIcebreaker());
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = () => {
    setIsShuffling(true);
    setTimeout(() => {
      const next = getRandomIcebreaker();
      setCurrentQuestion(next);
      setIsShuffling(false);
    }, 150);
  };

  return (
    <div
      id="chat-starters-unified-panel"
      className="border-t border-[#FFE5DD] bg-gradient-to-b from-[#FFFBF9] to-white p-2 sm:p-3 shadow-[0_-4px_16px_rgba(255,84,54,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Top Header & Tab switcher */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[#F5EAE1]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("question")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shrink-0",
              activeTab === "question"
                ? "bg-[#FF5436] text-white shadow-2xs"
                : "bg-white text-[#666059] border border-[#EBE3D5] hover:border-[#FFD5CC] hover:text-[#FF5436]"
            )}
          >
            <span>🎲</span>
            <span>Icebreaker Question</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shrink-0",
              activeTab === "quick"
                ? "bg-[#FF5436] text-white shadow-2xs"
                : "bg-white text-[#666059] border border-[#EBE3D5] hover:border-[#FFD5CC] hover:text-[#FF5436]"
            )}
          >
            <Zap className="h-3 w-3" />
            <span>Quick Greetings</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8C827A] hover:text-[#181513] hover:bg-black/5 transition-colors"
          title="Close starters"
          aria-label="Close conversation starters"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* Tab 1: Random Question */}
        {activeTab === "question" && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-[#FFD9CE] shadow-2xs">
              <div className="flex-1 min-w-0">
                <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#FF5436] bg-[#FFF0EB] px-1.5 py-0.2 rounded-full mb-0.5">
                  {currentQuestion.category}
                </span>
                <p className="text-xs sm:text-[13px] font-semibold text-[#181513] leading-snug">
                  "{currentQuestion.question}"
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleShuffle}
                className="h-7 px-2 shrink-0 text-[11px] font-bold text-[#FF5436] hover:bg-[#FFEAE3] rounded-full gap-1 border border-[#FFE0D6]"
                title="Roll another icebreaker question"
              >
                <Shuffle className={cn("h-3 w-3", isShuffling && "animate-spin")} />
                <span className="hidden xs:inline">Roll</span>
              </Button>
            </div>

            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelect(currentQuestion.question, false);
                  onClose();
                }}
                className="rounded-lg border-[#EBE3D5] text-[#554E46] text-xs h-7 px-2.5 hover:bg-[#FAF7F2]"
              >
                <MessageSquarePlus className="h-3 w-3 mr-1" />
                Edit in box
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSelect(currentQuestion.question, true);
                  onClose();
                }}
                className="rounded-lg bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs h-7 px-2.5 font-bold shadow-2xs"
              >
                <Send className="h-3 w-3 mr-1" />
                Send Question
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: AI Suggestions */}
        {/* Tab 2: Quick Greetings */}
        {activeTab === "quick" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {QUICK_REPLIES.map(({ label, emoji }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onSelect(label, true);
                  onClose();
                }}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-[#EBE3D5] bg-white hover:border-[#FF5436] hover:bg-[#FFF5F2] text-left transition-all active:scale-98 shadow-2xs group"
              >
                <span className="text-xs font-medium text-[#181513] group-hover:text-[#FF5436] flex items-center gap-1.5 truncate">
                  <span className="text-sm">{emoji}</span>
                  <span className="truncate">{label}</span>
                </span>
                <Send className="h-2.5 w-2.5 text-[#9E978D] group-hover:text-[#FF5436] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

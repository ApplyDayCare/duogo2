import { useState } from "react";
import { Sparkles, Shuffle, Send, CornerDownLeft, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRandomIcebreaker, IcebreakerQuestion, LIGHTHEARTED_ICEBREAKERS } from "@/data/icebreakers";
import { cn } from "@/lib/utils";

interface ChatIcebreakerCardProps {
  onInsert: (text: string) => void;
  onSend: (text: string) => void;
  onClose: () => void;
  matchName?: string;
}

export const ChatIcebreakerCard = ({
  onInsert,
  onSend,
  onClose,
  matchName = "your match",
}: ChatIcebreakerCardProps) => {
  const [current, setCurrent] = useState<IcebreakerQuestion>(() => getRandomIcebreaker());
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isAnimating, setIsAnimating] = useState(false);

  const categories = ["All", "Food & Drink", "Weekend Vibe", "Fun & Debates", "Travel & Adventures", "Music & Culture"];

  const handleShuffle = () => {
    setIsAnimating(true);
    setTimeout(() => {
      let pool = LIGHTHEARTED_ICEBREAKERS;
      if (selectedCategory !== "All") {
        pool = LIGHTHEARTED_ICEBREAKERS.filter((item) => item.category === selectedCategory);
      }
      const filtered = pool.filter((item) => item.id !== current.id);
      const chosenPool = filtered.length > 0 ? filtered : pool;
      const next = chosenPool[Math.floor(Math.random() * chosenPool.length)];
      setCurrent(next);
      setIsAnimating(false);
    }, 150);
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    let pool = LIGHTHEARTED_ICEBREAKERS;
    if (cat !== "All") {
      pool = LIGHTHEARTED_ICEBREAKERS.filter((item) => item.category === cat);
    }
    const next = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(next);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(current.question);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      id="chat-icebreaker-suggestion-card"
      className="relative rounded-3xl border-2 border-[#FFD9CE] bg-gradient-to-b from-[#FFFBF9] via-[#FFF6F3] to-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(255,84,54,0.12)] transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#FFE5DD]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF5436] text-white shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF5436]">
                Icebreaker Question
              </span>
              <span className="text-[10px] text-[#888177] font-medium hidden sm:inline">
                • Break the silence with {matchName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            id="btn-icebreaker-shuffle-top"
            variant="ghost"
            size="sm"
            onClick={handleShuffle}
            className="h-7 px-2 text-xs font-semibold text-[#FF5436] hover:bg-[#FFEAE3] rounded-full gap-1"
            title="Roll another question"
          >
            <Shuffle className={cn("h-3.5 w-3.5", isAnimating && "animate-spin")} />
            <span className="hidden xs:inline">Another</span>
          </Button>

          <button
            id="btn-icebreaker-close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#888177] hover:text-[#181513] hover:bg-[#FAF7F2] transition-colors"
            aria-label="Close icebreaker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pt-2.5 pb-1 no-scrollbar text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            id={`btn-cat-${cat.toLowerCase().replace(/[^a-z]/g, "")}`}
            onClick={() => handleSelectCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
              selectedCategory === cat
                ? "bg-[#FF5436] text-white font-semibold shadow-2xs"
                : "bg-white text-[#666059] border border-[#EBE3D5] hover:border-[#FFD5CC] hover:text-[#FF5436]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Question Card Box */}
      <div
        className={cn(
          "my-3 rounded-2xl bg-white border border-[#FFD9CE] p-3.5 sm:p-4 shadow-2xs transition-all",
          isAnimating ? "opacity-40 scale-[0.98]" : "opacity-100 scale-100"
        )}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none shrink-0" role="img" aria-label="emoji">
            {current.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-[#FFF0EB] text-[#FF5436] border-0 text-[10px] font-bold px-2 py-0">
                {current.category}
              </Badge>
            </div>
            <p className="text-sm sm:text-base font-serif font-medium text-[#181513] leading-snug select-text">
              "{current.question}"
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <Button
            id="btn-icebreaker-shuffle"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            className="h-8 rounded-full border-[#EBE3D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#666059] gap-1.5 active:scale-95"
          >
            <Shuffle className={cn("h-3.5 w-3.5 text-[#FF5436]", isAnimating && "animate-spin")} />
            <span>Shuffle Question</span>
          </Button>

          <Button
            id="btn-icebreaker-copy"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 rounded-full text-xs text-[#888177] hover:text-[#181513] hover:bg-white px-2.5"
            title="Copy question"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <Check className="h-3.5 w-3.5" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5" />
              </span>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            id="btn-icebreaker-insert"
            variant="outline"
            size="sm"
            onClick={() => onInsert(current.question)}
            className="h-8 rounded-full border-[#FFD9CE] bg-white hover:bg-[#FFF5F2] hover:text-[#FF5436] text-xs font-bold text-[#181513] gap-1.5 shadow-2xs active:scale-95"
            title="Insert into text field to customize"
          >
            <CornerDownLeft className="h-3.5 w-3.5 text-[#FF5436]" />
            <span>Insert & Edit</span>
          </Button>

          <Button
            id="btn-icebreaker-send"
            size="sm"
            onClick={() => onSend(current.question)}
            className="h-8 rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold px-4 gap-1.5 shadow-soft active:scale-95"
            title="Send immediately to chat"
          >
            <span>Send Now</span>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

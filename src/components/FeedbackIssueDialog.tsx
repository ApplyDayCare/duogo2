import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { posthog, trackEvent } from "@/lib/posthog";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  Send,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SURVEY_ID = "01a0daf0-eb7a-0000-356f-211fa0e2bfaa";
const SURVEY_NAME = "Feedback & issue report";
const RATING_QUESTION_ID = "71f62614-35f7-4d96-a641-36e29605ff64";
const CATEGORY_QUESTION_ID = "50428a2d-85a4-49c1-abb5-3e9cb88677ad";
const DETAILS_QUESTION_ID = "091f21a3-58fc-4e57-a3e1-6ecc67f67d43";

const CATEGORY_OPTIONS = [
  { label: "Sharing feedback", icon: MessageSquarePlus, color: "text-blue-500", bg: "bg-blue-50 hover:bg-blue-100/70 border-blue-200" },
  { label: "Reporting a bug or issue", icon: Bug, color: "text-[#FF5436]", bg: "bg-red-50 hover:bg-red-100/70 border-red-200" },
  { label: "Requesting a feature", icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-50 hover:bg-amber-100/70 border-amber-200" },
  { label: "Something else", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50 hover:bg-purple-100/70 border-purple-200" },
];

const EMOJI_RATINGS = [
  { score: 1, emoji: "😡", label: "Very poor" },
  { score: 2, emoji: "🙁", label: "Poor" },
  { score: 3, emoji: "😐", label: "Average" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😍", label: "Excellent" },
];

interface FeedbackIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackIssueDialog: React.FC<FeedbackIssueDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("Sharing feedback");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Track impression when dialog opens
  React.useEffect(() => {
    if (open) {
      setIsSubmitted(false);
      trackEvent("survey shown", {
        $survey_id: SURVEY_ID,
        $survey_name: SURVEY_NAME,
        path: window.location.pathname,
      });
      trackEvent("feedback_modal_opened", {
        path: window.location.pathname,
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === null) {
      toast({
        title: "Rating required",
        description: "Please select an experience rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const currentPath = window.location.pathname;

      // 1. Official PostHog survey sent payload matching the survey schema
      const surveyPayload = {
        $survey_id: SURVEY_ID,
        $survey_name: SURVEY_NAME,
        $survey_submission_id: submissionId,
        $survey_completed: true,
        [`$survey_response_${RATING_QUESTION_ID}`]: rating,
        [`$survey_response_${CATEGORY_QUESTION_ID}`]: category,
        [`$survey_response_${DETAILS_QUESTION_ID}`]: details.trim(),
        $survey_questions: [
          {
            id: RATING_QUESTION_ID,
            question: "How would you rate your experience so far?",
            response: rating,
          },
          {
            id: CATEGORY_QUESTION_ID,
            question: "What brings you here today?",
            response: category,
          },
          {
            id: DETAILS_QUESTION_ID,
            question: "Tell us more – what's on your mind?",
            response: details.trim(),
          },
        ],
        current_path: currentPath,
        user_id: user?.id,
        user_email: user?.email,
      };

      // Capture official PostHog event
      posthog.capture("survey sent", surveyPayload);

      // 2. Additional specific event for analytics and bug tracking
      if (category === "Reporting a bug or issue") {
        posthog.capture("issue_reported", {
          issue_description: details.trim(),
          rating,
          category,
          path: currentPath,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        });
      } else {
        posthog.capture("feedback_submitted", {
          feedback_text: details.trim(),
          rating,
          category,
          path: currentPath,
          timestamp: new Date().toISOString(),
        });
      }

      setIsSubmitted(true);
      toast({
        title: "Thank you for your feedback!",
        description: "Your report has been sent to our team.",
      });

      // Auto-close dialog after 1.8 seconds
      setTimeout(() => {
        onOpenChange(false);
        // Reset form
        setRating(null);
        setCategory("Sharing feedback");
        setDetails("");
        setIsSubmitted(false);
      }, 1800);
    } catch (err) {
      console.error("Failed to submit feedback survey:", err);
      toast({
        title: "Error submitting feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 bg-[#FAF7F2] border-[#EBE3D5] rounded-3xl shadow-xl">
        {isSubmitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-[#E8F8F0] border border-[#2EC4B6]/30 flex items-center justify-center text-[#2EC4B6] animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-2xl font-bold text-[#181513]">Thank you!</h3>
              <p className="text-sm text-[#666059] max-w-xs mx-auto">
                We read every report and survey response to make duogo better for you.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader className="text-left space-y-1.5 pb-2 border-b border-[#EBE3D5]">
              <DialogTitle className="font-serif text-xl sm:text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-[#FFF0EB] text-[#FF5436] inline-flex">
                  <MessageSquarePlus className="h-5 w-5" />
                </span>
                Feedback & Issue Report
              </DialogTitle>
              <DialogDescription className="text-xs text-[#666059]">
                Connected directly to PostHog. Tell us what's working, what's broken, or what you'd love to see.
              </DialogDescription>
            </DialogHeader>

            {/* Question 1: Experience Rating */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#181513] uppercase tracking-wider block">
                1. How would you rate your experience so far? <span className="text-[#FF5436]">*</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {EMOJI_RATINGS.map((item) => {
                  const isSelected = rating === item.score;
                  return (
                    <button
                      key={item.score}
                      type="button"
                      onClick={() => setRating(item.score)}
                      className={cn(
                        "flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border transition-all active:scale-95 text-center",
                        isSelected
                          ? "bg-[#FFF0EB] border-[#FF5436] shadow-2xs ring-2 ring-[#FF5436]/20 font-bold"
                          : "bg-white border-[#EBE3D5] hover:bg-[#FDFBF8] hover:border-[#DED5C5]"
                      )}
                    >
                      <span className="text-2xl select-none mb-1">{item.emoji}</span>
                      <span className="text-[10px] text-[#666059] leading-tight font-medium">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 2: What brings you here today? */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#181513] uppercase tracking-wider block">
                2. What brings you here today?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((opt) => {
                  const isSelected = category === opt.label;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setCategory(opt.label)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all active:scale-95",
                        isSelected
                          ? "bg-white border-[#FF5436] text-[#181513] shadow-2xs ring-2 ring-[#FF5436]/20 font-bold"
                          : "bg-white/80 border-[#EBE3D5] text-[#443F39] hover:bg-white"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-[#FF5436]" : opt.color)} />
                      <span className="leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 3: Tell us more */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#181513] uppercase tracking-wider block">
                  3. Tell us more – what's on your mind?
                </label>
                <span className="text-[10px] text-[#888177]">Optional</span>
              </div>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={
                  category === "Reporting a bug or issue"
                    ? "What happened? What screen were you on? Any error messages?"
                    : category === "Requesting a feature"
                    ? "What feature or idea would make duogo even better for you?"
                    : "Share any thoughts, compliments, or suggestions..."
                }
                rows={3}
                className="bg-white border-[#EBE3D5] text-xs resize-none rounded-xl focus-visible:ring-[#FF5436]"
              />
              {category === "Reporting a bug or issue" && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#888177] bg-white/60 p-2 rounded-lg border border-[#EBE3D5]">
                  <Info className="h-3.5 w-3.5 text-[#FF5436] shrink-0" />
                  <span>Current URL path will be included to help the dev team reproduce the issue.</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EBE3D5]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-full text-xs text-[#666059] hover:bg-[#EFE8DD]/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || rating === null}
                className="rounded-full bg-[#FF5436] hover:bg-[#E04428] text-white text-xs font-bold px-5 gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

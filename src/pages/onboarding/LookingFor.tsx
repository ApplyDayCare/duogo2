import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingProgress from "@/components/OnboardingProgress";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LookingForOption {
  id: string;
  label: string;
  emoji: string;
}

const SOLO_OPTIONS: LookingForOption[] = [
  { id: "make_friends", label: "Make new friends", emoji: "👯‍♀️" },
  { id: "get_out_more", label: "Get out more", emoji: "💫" },
  { id: "meaningful_convos", label: "Have meaningful conversations", emoji: "💬" },
  { id: "casual_hangouts", label: "Coffee & casual hangouts", emoji: "☕" },
  { id: "new_in_town", label: "I'm new in town", emoji: "🌃" },
  { id: "activity_fitness", label: "Activity & fitness buddy", emoji: "🏃" },
  { id: "exploring_travel", label: "Exploring while traveling", emoji: "🌍" },
];

const COUPLE_OPTIONS: LookingForOption[] = [
  { id: "couple_friends", label: "Make couple friends & double dates", emoji: "🥂" },
  { id: "get_out_more", label: "Get out more & try new spots", emoji: "💫" },
  { id: "meaningful_convos", label: "Have meaningful conversations", emoji: "💬" },
  { id: "game_dinner_nights", label: "Game nights & dinner parties", emoji: "🎲" },
  { id: "family_playdates", label: "Family & playdate outings", emoji: "👶" },
  { id: "new_in_town", label: "We're new in town", emoji: "🌃" },
  { id: "travel_adventures", label: "Exploring & weekend trips", emoji: "🌍" },
];

const MAX_SELECTION = 2;

const LookingFor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = getSignupDraft();
  const isCouple = draft.user_type === "couple";

  const options = isCouple ? COUPLE_OPTIONS : SOLO_OPTIONS;
  const currentStep = isCouple ? 5 : 4;
  const totalSteps = isCouple ? 7 : 6;

  const [selected, setSelected] = useState<string[]>(() => {
    if (draft.looking_for && Array.isArray(draft.looking_for)) {
      return draft.looking_for;
    }
    return [];
  });

  const [loading, setLoading] = useState(false);

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_SELECTION) {
        // Replace oldest or keep max 2 by replacing last
        return [prev[1] || prev[0], id];
      }
      return [...prev, id];
    });
  };

  const handleBack = () => {
    if (isCouple) {
      navigate("/onboarding/kids");
    } else {
      navigate("/onboarding/gender");
    }
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;

    updateSignupDraft({
      looking_for: selected,
    });

    if (user) {
      setLoading(true);
      try {
        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", user.id);
      } catch (e) {
        console.warn("Profile update error:", e);
      } finally {
        setLoading(false);
      }
    }

    if (isCouple) {
      navigate("/onboarding/couple-setup");
    } else {
      navigate("/onboarding/profile");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-xs font-bold tracking-wider uppercase text-[#7A746C]">
            Preferences
          </span>
          <div className="w-10" />
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />

        <div className="space-y-1.5 text-center pt-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground tracking-tight">
            What are you looking for?
          </h1>
          <p className="text-sm text-[#706A62] dark:text-muted-foreground font-medium">
            Select up to {MAX_SELECTION} preferences
          </p>
        </div>

        {/* Generous Grid of Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {options.map((option) => {
            const isSelected = selected.includes(option.id);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(option.id)}
                className={`w-full text-left flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl border-2 transition-all duration-200 select-none cursor-pointer shadow-soft hover:shadow-card hover:-translate-y-0.5 min-h-[58px] sm:min-h-[64px] ${
                  isSelected
                    ? "border-[#FF5436] bg-[#FFF9F7] dark:bg-card ring-4 ring-[#FF5436]/15"
                    : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <span className="text-xl sm:text-2xl shrink-0" role="img" aria-label={option.label}>
                    {option.emoji}
                  </span>
                  <span
                    className={`text-sm sm:text-base font-semibold leading-snug ${
                      isSelected
                        ? "text-[#1A1816] dark:text-foreground"
                        : "text-[#1A1816]/90 dark:text-foreground/90"
                    }`}
                  >
                    {option.label}
                  </span>
                </div>

                {/* Selection Indicator Circle */}
                <div className="shrink-0 ml-2">
                  {isSelected ? (
                    <div className="h-6 w-6 rounded-full bg-[#FF5436] flex items-center justify-center text-white transition-transform scale-100 shadow-xs">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-[#EFE8DD] dark:border-border transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="pt-2 space-y-3">
          <Button
            onClick={handleContinue}
            disabled={selected.length === 0 || loading}
            className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Saving..." : "Continue →"}
          </Button>

          {/* Footer disclaimer */}
          <p className="text-center text-xs text-[#706A62]/90 dark:text-muted-foreground/80 pt-1">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default LookingFor;

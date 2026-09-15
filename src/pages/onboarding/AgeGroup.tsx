import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, Coffee, Trees, Sun } from "lucide-react";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import OnboardingProgress from "@/components/OnboardingProgress";

const AGE_GROUP_OPTIONS = [
  {
    id: "18-29",
    label: "Age 18–29",
    description: "Young adults & 20s",
    emoji: "⚡",
    icon: Sparkles,
  },
  {
    id: "30-39",
    label: "Age 30–39",
    description: "30s professionals & friends",
    emoji: "🍷",
    icon: Coffee,
  },
  {
    id: "40-49",
    label: "Age 40–49",
    description: "40s social circle",
    emoji: "🌿",
    icon: Trees,
  },
  {
    id: "50+",
    label: "Age 50+",
    description: "50+ mature & active",
    emoji: "💫",
    icon: Sun,
  },
] as const;

const AgeGroup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentDraft = getSignupDraft();
  const [selectedAge, setSelectedAge] = useState<string | null>(currentDraft.age_group || null);
  const [loading, setLoading] = useState(false);

  const isCouple = currentDraft.user_type === "couple";
  const nextRoute = "/onboarding/gender";

  const handleSelectAge = (ageId: string) => {
    setSelectedAge(ageId);
    updateSignupDraft({ age_group: ageId });
  };

  const handleContinue = async () => {
    if (!selectedAge) return;

    updateSignupDraft({ age_group: selectedAge });

    if (user) {
      setLoading(true);
      try {
        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", user.id);
      } catch (err) {
        console.warn("Could not update profile timestamp:", err);
      } finally {
        setLoading(false);
      }
    }

    navigate(nextRoute);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] dark:bg-background px-4 py-4 sm:py-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-5">
        <button
          onClick={() => navigate("/onboarding/user-type")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Account Type
        </button>

        <OnboardingProgress currentStep={2} totalSteps={isCouple ? 7 : 6} />

        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground tracking-tight">
            What is your age group?
          </h1>
          <p className="text-xs sm:text-sm text-[#706A62] dark:text-muted-foreground">
            We match you with friends in a similar life stage
          </p>
        </div>

        {/* Compact 2x2 Grid of Age Group Cards matching Duogo design system */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {AGE_GROUP_OPTIONS.map((group) => {
            const isSelected = selectedAge === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleSelectAge(group.id)}
                className={`group relative flex items-center gap-3 text-left rounded-2xl bg-white dark:bg-card p-3 sm:p-3.5 transition-all duration-200 border-2 cursor-pointer shadow-soft hover:shadow-card hover:-translate-y-0.5 ${
                  isSelected
                    ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7] dark:bg-card"
                    : "border-[#EFE8DD] hover:border-[#DECBBF] dark:border-border"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436] text-xl font-bold group-hover:scale-105 transition-transform">
                  {group.emoji}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-serif text-base font-bold text-[#1A1816] dark:text-foreground leading-tight">
                      {group.label}
                    </span>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5436] text-white shrink-0">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#706A62] dark:text-muted-foreground truncate leading-tight">
                    {group.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!selectedAge || loading}
          className="h-12 w-full text-base font-bold rounded-full bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_6px_20px_rgba(255,84,54,0.30)] transition-all cursor-pointer disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving...</span>
            </span>
          ) : (
            <span>Continue to {isCouple ? "Couple Role" : "Gender"} →</span>
          )}
        </Button>

        {/* Footer disclaimer */}
        <p className="text-center text-[11px] text-[#706A62]/90 dark:text-muted-foreground/80 pt-0.5">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/privacy" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/safety" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
            Community Guidelines
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default AgeGroup;

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, Lock, HeartHandshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import OnboardingProgress from "@/components/OnboardingProgress";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SOLO_GENDER_OPTIONS = [
  {
    id: "male",
    label: "Male",
    description: "Identify as male",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    id: "female",
    label: "Female",
    description: "Identify as female",
    iconColor: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
  },
] as const;

const COUPLE_ROLE_OPTIONS = [
  {
    id: "husband",
    label: "Husband",
    description: "Husband of the couple",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    id: "wife",
    label: "Wife",
    description: "Wife of the couple",
    iconColor: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
  },
] as const;

const Gender = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = getSignupDraft();
  const isCouple = draft.user_type === "couple";
  const [selectedOption, setSelectedOption] = useState<string>(draft.gender || "");
  const [loading, setLoading] = useState(false);

  const options = isCouple ? COUPLE_ROLE_OPTIONS : SOLO_GENDER_OPTIONS;

  const handleSelect = async (optionId: string) => {
    setSelectedOption(optionId);
    const updated = updateSignupDraft({ gender: optionId });

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

    // Smooth forward transition based on user type
    const nextRoute = updated.user_type === "couple" ? "/onboarding/kids" : "/onboarding/looking-for";
    setTimeout(() => {
      navigate(nextRoute);
    }, 150);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] dark:bg-background px-4 py-4 sm:py-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-5">
        <button
          onClick={() => navigate("/onboarding/age")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Age Group
        </button>

        <OnboardingProgress currentStep={3} totalSteps={isCouple ? 7 : 6} />

        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground tracking-tight">
            {isCouple ? "Are you the husband or wife?" : "What is your gender?"}
          </h1>
          <p className="text-xs sm:text-sm text-[#706A62] dark:text-muted-foreground">
            {isCouple
              ? "Select your role in the couple"
              : "Select your gender to help us find your crowd"}
          </p>
        </div>

        {/* Options Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((option) => {
            const isSelected = selectedOption === option.id;
            return (
              <Card
                key={option.id}
                onClick={() => !loading && handleSelect(option.id)}
                className={`cursor-pointer border-2 transition-all duration-200 rounded-2xl shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.98] ${
                  isSelected
                    ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7] dark:bg-card"
                    : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
                }`}
              >
                <CardContent className="flex flex-col items-center text-center p-4 space-y-2">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${option.bgColor} transition-transform group-hover:scale-105`}
                  >
                    {isCouple ? (
                      <HeartHandshake className={`h-6 w-6 ${option.iconColor}`} />
                    ) : (
                      <User className={`h-6 w-6 ${option.iconColor}`} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-serif text-base font-bold text-[#1A1816] dark:text-foreground">{option.label}</h2>
                    <p className="text-xs text-[#706A62] dark:text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Privacy Note */}
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 px-3.5 py-3 text-left text-xs text-muted-foreground">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-foreground">Private & Protected:</strong> Your gender is not visible to anyone until you accept the match and get connected.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#FF5436] border-t-transparent" />
          </div>
        )}

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
  );
};

export default Gender;

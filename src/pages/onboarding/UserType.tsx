import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import OnboardingProgress from "@/components/OnboardingProgress";
import { User, Users, ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";

const UserType = () => {
  const { user, profile, isProfileComplete, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const draft = getSignupDraft();
  const activeUserType = draft.user_type || profile?.user_type;

  // Pre-check: If user already has a complete profile in database, bypass signup steps
  useEffect(() => {
    if (
      !profileLoading &&
      user &&
      (
        profile?.onboarding_completed ||
        profile?.quiz_completed ||
        isProfileComplete ||
        Boolean(profile?.first_name && profile.first_name.trim().length > 0)
      )
    ) {
      console.info("[AuthGuard:UserType] User already has an active profile. Redirecting to dashboard.", {
        userId: user.id,
        onboardingCompleted: profile?.onboarding_completed,
        isProfileComplete,
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, profile?.onboarding_completed, profile?.quiz_completed, profile?.first_name, isProfileComplete, profileLoading, navigate]);

  if (user && profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF5436] border-t-transparent" />
      </div>
    );
  }

  const handleSelect = async (type: "solo" | "couple") => {
    updateSignupDraft({ user_type: type });

    if (user) {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ user_type: type })
        .eq("id", user.id);
      setLoading(false);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    navigate("/onboarding/age");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>
          <button
            onClick={() => navigate("/?login=true")}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FF5436] hover:underline cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            Log In
          </button>
        </div>

        <OnboardingProgress currentStep={1} totalSteps={6} />

        <div className="space-y-1.5 text-center pt-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] tracking-tight">
            How are you looking for friends?
          </h1>
          <p className="text-sm text-[#706A62]">
            Choose whether you're joining solo or as a couple
          </p>
        </div>

        <div className="grid gap-4 pt-1">
          {/* Solo Card */}
          <div
            className={`group cursor-pointer rounded-3xl border-2 bg-white p-5 sm:p-6 transition-all duration-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.99] ${
              activeUserType === "solo"
                ? "border-[#FF5436] ring-4 ring-[#FF5436]/15 bg-[#FFF9F7]"
                : "border-[#EFE8DD] hover:border-[#DECBBF]"
            }`}
            onClick={() => !loading && handleSelect("solo")}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436] font-bold group-hover:scale-105 transition-transform shadow-xs">
                <User className="h-7 w-7 stroke-[2.2]" />
              </div>
              <div className="flex-1 space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold text-[#1A1816]">Solo</h2>
                  <span className="text-xs font-bold text-[#3EB489] bg-[#E8F8F1] px-3 py-1 rounded-full border border-[#BDEBD7]">
                    Most Popular
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#66615B] leading-relaxed">
                  Just me: I want 1-on-1 platonic friends for coffee, hikes, hobbies, and weekend hangs.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5EFE8] flex items-center justify-between text-xs sm:text-sm font-bold text-[#FF5436]">
              <span>Continue as Solo</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Couple Card */}
          <div
            className={`group cursor-pointer rounded-3xl border-2 bg-white p-5 sm:p-6 transition-all duration-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.99] ${
              activeUserType === "couple"
                ? "border-[#FF5436] ring-4 ring-[#FF5436]/15 bg-[#FFF9F7]"
                : "border-[#EFE8DD] hover:border-[#DECBBF]"
            }`}
            onClick={() => !loading && handleSelect("couple")}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436] font-bold group-hover:scale-105 transition-transform shadow-xs">
                <Users className="h-7 w-7 stroke-[2.2]" />
              </div>
              <div className="flex-1 space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold text-[#1A1816]">Couple</h2>
                  <span className="text-xs font-bold text-[#FF5436] bg-[#FFF0EB] px-3 py-1 rounded-full border border-[#FFD9CE]">
                    Double Dates
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#66615B] leading-relaxed">
                  Me & my partner: we want another compatible couple for game nights, dinners, and trips.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5EFE8] flex items-center justify-between text-xs sm:text-sm font-bold text-[#FF5436]">
              <span>Continue as Couple</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center pt-2">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#FF5436] border-t-transparent" />
          </div>
        )}

        <div className="pt-4 text-center">
          <p className="text-xs sm:text-sm text-[#706A62]">
            Already signed up previously?{" "}
            <button
              onClick={() => navigate("/?login=true")}
              className="font-bold text-[#FF5436] hover:underline cursor-pointer"
            >
              Log in to your account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserType;

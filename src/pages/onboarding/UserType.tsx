import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import OnboardingProgress from "@/components/OnboardingProgress";
import { User, Users, ArrowLeft, ArrowRight } from "lucide-react";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";

const UserType = () => {
  const { user, profile, isProfileComplete } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const draft = getSignupDraft();
  const activeUserType = draft.user_type || profile?.user_type;

  // Pre-check: If user already has a complete profile in database, bypass signup steps
  useEffect(() => {
    if (user && (profile?.onboarding_completed || isProfileComplete)) {
      console.info("[AuthGuard:UserType] User already has a complete profile. Redirecting to dashboard.", {
        userId: user.id,
        onboardingCompleted: profile?.onboarding_completed,
        isProfileComplete,
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, profile?.onboarding_completed, isProfileComplete, navigate]);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] dark:bg-background px-4 py-4 sm:py-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-5">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </button>

        <OnboardingProgress currentStep={1} totalSteps={6} />

        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] tracking-tight">
            How are you looking for friends?
          </h1>
          <p className="text-xs sm:text-sm text-[#706A62]">
            Choose whether you're joining solo or as a couple
          </p>
        </div>

        <div className="grid gap-3">
          {/* Solo Card */}
          <div
            className={`group cursor-pointer rounded-2xl border-2 bg-white p-4 sm:p-5 transition-all duration-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 ${
              activeUserType === "solo"
                ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7]"
                : "border-[#EFE8DD] hover:border-[#DECBBF]"
            }`}
            onClick={() => !loading && handleSelect("solo")}
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436] font-bold group-hover:scale-105 transition-transform">
                <User className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 space-y-0.5 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-lg font-bold text-[#1A1816]">Solo</h2>
                  <span className="text-[10px] font-bold text-[#3EB489] bg-[#E8F8F1] px-2.5 py-0.5 rounded-full border border-[#BDEBD7]">
                    Most Popular
                  </span>
                </div>
                <p className="text-xs text-[#66615B] leading-relaxed">
                  Just me: I want 1-on-1 platonic friends for coffee, hikes, hobbies, and weekend hangs.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F5EFE8] flex items-center justify-between text-xs font-bold text-[#FF5436]">
              <span>Continue as Solo</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Couple Card */}
          <div
            className={`group cursor-pointer rounded-2xl border-2 bg-white p-4 sm:p-5 transition-all duration-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 ${
              activeUserType === "couple"
                ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7]"
                : "border-[#EFE8DD] hover:border-[#DECBBF]"
            }`}
            onClick={() => !loading && handleSelect("couple")}
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436] font-bold group-hover:scale-105 transition-transform">
                <Users className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 space-y-0.5 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-lg font-bold text-[#1A1816]">Couple</h2>
                  <span className="text-[10px] font-bold text-[#FF5436] bg-[#FFF0EB] px-2.5 py-0.5 rounded-full border border-[#FFD9CE]">
                    Double Dates
                  </span>
                </div>
                <p className="text-xs text-[#66615B] leading-relaxed">
                  Me & my partner: we want another compatible couple for game nights, dinners, and trips.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F5EFE8] flex items-center justify-between text-xs font-bold text-[#FF5436]">
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
      </div>
    </div>
  );
};

export default UserType;

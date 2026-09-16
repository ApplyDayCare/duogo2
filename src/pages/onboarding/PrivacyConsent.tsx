import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Info, Loader2 } from "lucide-react";
import { getSignupDraft, updateSignupDraft, syncSignupDraftToSupabase, clearSignupDraft } from "@/lib/signupState";
import { supabase } from "@/integrations/supabase/client";

interface DataItem {
  id: string;
  title: string;
  detail: string;
}

const DATA_ITEMS: DataItem[] = [
  {
    id: "profile",
    title: "Your profile",
    detail: "Name, age group, interests, and dining preferences you share with matches",
  },
  {
    id: "location",
    title: "Your city-level location",
    detail: "To find matches in your area, never your live GPS or exact address",
  },
  {
    id: "feedback",
    title: "Your feedback to us",
    detail: "Post-hangout ratings and safety check-ins to maintain a trusted community",
  },
  {
    id: "usage",
    title: "Your use of this app",
    detail: "Activity and interaction insights to continuously improve your experience",
  },
];

const PrivacyConsent = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      updateSignupDraft({ privacy_consented: true });

      if (!user) {
        navigate("/onboarding/verify");
        return;
      }

      const draft = getSignupDraft();
      const firstName = draft.first_name?.trim() || profile?.first_name?.trim() || user.user_metadata?.first_name || user.email?.split("@")[0] || "Member";
      const userType = draft.user_type || profile?.user_type || "solo";
      const locationCity = draft.location_city || profile?.location_city || "Milton";

      // Explicitly persist complete profile state in Supabase using UPDATE first
      const profileData = {
        email: user.email,
        first_name: firstName,
        user_type: userType,
        location_city: locationCity,
        privacy_consented: true,
        onboarding_completed: true,
        quiz_completed: true,
        last_active: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", user.id);

      if (updateErr) {
        await supabase
          .from("profiles")
          .upsert({ id: user.id, ...profileData } as any, { onConflict: "id" });
      }

      await syncSignupDraftToSupabase(user);
      const updated = await refreshProfile();

      if (updated?.onboarding_completed && updated?.first_name) {
        clearSignupDraft();
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Privacy consent continue error:", err);
      navigate("/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    // Explicitly return to the Quiz step
    navigate("/quiz");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background text-foreground flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-7 flex-1 flex flex-col justify-start">
        {/* Top Back Navigation */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quiz
        </button>

        {/* Main Content Area */}
        <div className="space-y-6 pt-2">
          {/* Header */}
          <div className="space-y-2 text-left">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1816] dark:text-foreground">
              Let's Talk About Your Data
            </h1>
            <p className="text-sm sm:text-base text-[#706A62] dark:text-muted-foreground leading-relaxed">
              DuoGo is constantly seeking to improve your online and offline experiences. To help us accomplish this, we must collect data from our users, including:
            </p>
          </div>

          {/* List of Collected Data */}
          <div className="space-y-4 py-2">
            {DATA_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3.5 group bg-white dark:bg-card p-4 rounded-2xl border border-[#EFE8DD] shadow-soft"
              >
                <div className="h-7 w-7 rounded-full bg-[#FFF0EB] border border-[#FFD9CE] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-[#FF5436] stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#1A1816] dark:text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#706A62] dark:text-muted-foreground leading-relaxed mt-0.5">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy Callout Banner */}
          <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <div className="shrink-0 mt-0.5 text-[#FF5436]">
              <Info className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[#1A1816] leading-relaxed">
              Your privacy is important to us. We do not sell your profile data or contact information to any third-parties.
            </p>
          </div>

          {/* Action Button */}
          <div className="space-y-3 pt-2">
            <Button
              className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer"
              onClick={handleContinue}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                "Continue to Account Verification →"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer link to full policy */}
      <div className="text-center py-4 text-xs text-[#706A62]">
        <span>Read our complete </span>
        <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-[#1A1816] font-semibold">
          Privacy Policy
        </a>
      </div>
    </div>
  );
};

export default PrivacyConsent;

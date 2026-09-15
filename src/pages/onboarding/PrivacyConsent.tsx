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
    <div className="min-h-screen bg-[#f7f4ee] dark:bg-background text-foreground flex flex-col justify-between px-4 py-6 md:py-10">
      <div className="w-full max-w-md mx-auto space-y-7">
        {/* Top Back Navigation */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quiz
        </button>

        {/* Main Content Area */}
        <div className="space-y-6 pt-2">
          {/* Header */}
          <div className="space-y-3 text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Let's Talk About Your Data
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              DuoGo is constantly seeking to improve your online and offline experiences. To help us accomplish this, we must collect data from our users, including:
            </p>
          </div>

          {/* List of Collected Data */}
          <div className="space-y-4 py-2">
            {DATA_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3.5 group"
              >
                <div className="h-6 w-6 rounded-full border border-foreground/40 dark:border-primary/50 flex items-center justify-center shrink-0 mt-0.5 bg-white/60 dark:bg-card">
                  <Check className="h-3.5 w-3.5 text-foreground dark:text-primary stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy Callout Banner */}
          <div className="rounded-2xl bg-[#ebe6dc] dark:bg-card/70 border border-border/40 p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <div className="shrink-0 mt-0.5 text-foreground/80 dark:text-primary">
              <Info className="h-5 w-5 fill-foreground/15 stroke-foreground dark:stroke-primary" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-relaxed">
              Your privacy is important to us. We do not sell your profile data or contact information to any third-parties.
            </p>
          </div>

          {/* Action Button */}
          <div className="space-y-3 pt-2">
            <Button
              className="h-13 w-full text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 shadow-md transition-all active:scale-[0.99] cursor-pointer"
              onClick={handleContinue}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                "Continue"
              )}
            </Button>
            {/* Sheet Handle Accent */}
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
          </div>
        </div>
      </div>

      {/* Footer link to full policy */}
      <div className="text-center py-4 text-xs text-muted-foreground">
        <span>Read our complete </span>
        <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground font-medium">
          Privacy Policy
        </a>
      </div>
    </div>
  );
};

export default PrivacyConsent;

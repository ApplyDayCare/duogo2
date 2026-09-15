import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { syncSignupDraftToSupabase, getSignupDraft, clearSignupDraft } from "@/lib/signupState";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Sync any pending signup draft data to Supabase profile & quiz_responses
        await syncSignupDraftToSupabase(session.user);

        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed, quiz_completed, first_name, user_type")
          .eq("id", session.user.id)
          .maybeSingle();

        const draft = getSignupDraft();
        const effectiveUserType = profile?.user_type || draft.user_type;
        const effectiveFirstName = profile?.first_name || draft.first_name;
        const effectiveQuizCompleted = profile?.quiz_completed || draft.quiz_completed;

        const isComplete = Boolean(
          profile &&
          profile.onboarding_completed &&
          profile.quiz_completed &&
          profile.first_name &&
          profile.first_name.trim().length > 0 &&
          (profile.user_type === "solo" || profile.user_type === "couple")
        );

        if (!isComplete) {
          if (!effectiveUserType) {
            navigate("/onboarding/user-type", { replace: true });
          } else if (!effectiveFirstName) {
            navigate(effectiveUserType === "couple" ? "/onboarding/couple-setup" : "/onboarding/profile", { replace: true });
          } else if (!effectiveQuizCompleted) {
            navigate("/quiz", { replace: true });
          } else {
            navigate("/onboarding/privacy-consent", { replace: true });
          }
        } else {
          clearSignupDraft();
          navigate("/dashboard", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf9f4] dark:bg-background">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Setting up your profile & matches...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

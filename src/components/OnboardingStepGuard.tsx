import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getSignupDraft, hasSignupDraft } from "@/lib/signupState";

interface OnboardingStepGuardProps {
  children: ReactNode;
  /**
   * Optional minimum requirement for this step:
   * "user_type": Requires user_type to be chosen (e.g., for age, gender, kids, looking-for, couple-setup, solo-profile)
   * "location": Requires basic profile setup
   * "quiz": Requires profile/kids setup
   * "consent": Requires quiz or prior steps
   */
  requiredStage?: "user_type" | "profile" | "quiz" | "consent";
}

/**
 * Guard for mid-step onboarding routes.
 * Prevents unauthenticated direct URL access (e.g. /onboarding/location)
 * by redirecting brand-new visitors with no local draft to /signup,
 * while allowing logged-in users (or users with active signup drafts) to proceed freely.
 */
export const OnboardingStepGuard = ({ children, requiredStage = "user_type" }: OnboardingStepGuardProps) => {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  // If auth is still resolving, show light spinner
  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF5436] border-t-transparent" />
      </div>
    );
  }

  // Only redirect authenticated users to /dashboard if BOTH onboarding and quiz are completed
  if (user && profile?.onboarding_completed && profile?.quiz_completed) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check draft or profile data for stage requirements
  const draft = getSignupDraft();
  const hasDraft = hasSignupDraft();
  const effectiveUserType = profile?.user_type || draft.user_type;

  // If user is not authenticated and has no local draft, redirect to /signup
  if (!user && (!hasDraft || !draft.user_type)) {
    console.info(`[OnboardingStepGuard] Direct access to ${location.pathname} with no draft or session. Redirecting to /signup.`);
    return <Navigate to="/signup" replace state={{ from: location.pathname }} />;
  }

  // Stage checks
  if (requiredStage === "profile" && !effectiveUserType) {
    return <Navigate to="/onboarding/user-type" replace />;
  }

  return <>{children}</>;
};

export default OnboardingStepGuard;

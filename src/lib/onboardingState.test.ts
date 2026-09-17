import { describe, it, expect, beforeEach } from "vitest";
import {
  getSignupDraft,
  updateSignupDraft,
  clearSignupDraft,
  hasSignupDraft,
} from "@/lib/signupState";

describe("Onboarding State Management & Draft Handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Cross-Device Draft Cleanup", () => {
    it("clears duogo_signup_draft upon clearSignupDraft invocation", () => {
      updateSignupDraft({
        user_type: "solo",
        age_group: "30-39",
        first_name: "Taylor",
      });

      expect(hasSignupDraft()).toBe(true);
      expect(getSignupDraft().first_name).toBe("Taylor");

      // Simulate cleanup triggered by AuthContext when profile.onboarding_completed is true
      clearSignupDraft();

      expect(hasSignupDraft()).toBe(false);
      expect(getSignupDraft()).toEqual({});
      expect(localStorage.getItem("duogo_signup_draft")).toBeNull();
    });

    it("hasSignupDraft returns false if storage has no meaningful draft values", () => {
      expect(hasSignupDraft()).toBe(false);

      localStorage.setItem("duogo_signup_draft", JSON.stringify({}));
      expect(hasSignupDraft()).toBe(false);
    });

    it("hasSignupDraft returns true when user_type or other key fields are drafted", () => {
      updateSignupDraft({ user_type: "couple" });
      expect(hasSignupDraft()).toBe(true);
    });
  });

  describe("Mid-step Direct URL Access Guard Logic", () => {
    // Mimics the decision logic in OnboardingStepGuard
    function evaluateOnboardingAccess(params: {
      user: { id: string } | null;
      profile: { onboarding_completed?: boolean; first_name?: string; quiz_completed?: boolean } | null;
      draft: ReturnType<typeof getSignupDraft>;
      hasDraft: boolean;
    }): "allow" | "redirect_signup" | "redirect_dashboard" {
      const { user, profile, draft, hasDraft } = params;

      // 1. Authenticated user with completed profile -> dashboard
      if (user && (profile?.onboarding_completed || (profile?.first_name && profile?.quiz_completed))) {
        return "redirect_dashboard";
      }

      // 2. Authenticated user in progress -> allow
      if (user) {
        return "allow";
      }

      // 3. Unauthenticated guest with no draft -> redirect to /signup
      if (!hasDraft || !draft.user_type) {
        return "redirect_signup";
      }

      // 4. Unauthenticated guest with valid draft -> allow
      return "allow";
    }

    it("redirects unauthenticated guests with no draft to /signup", () => {
      const decision = evaluateOnboardingAccess({
        user: null,
        profile: null,
        draft: {},
        hasDraft: false,
      });
      expect(decision).toBe("redirect_signup");
    });

    it("allows unauthenticated guests who have already selected a user_type to proceed", () => {
      updateSignupDraft({ user_type: "solo" });
      const decision = evaluateOnboardingAccess({
        user: null,
        profile: null,
        draft: getSignupDraft(),
        hasDraft: hasSignupDraft(),
      });
      expect(decision).toBe("allow");
    });

    it("redirects already-completed users to /dashboard", () => {
      const decision = evaluateOnboardingAccess({
        user: { id: "user-123" },
        profile: { onboarding_completed: true, first_name: "Morgan" },
        draft: {},
        hasDraft: false,
      });
      expect(decision).toBe("redirect_dashboard");
    });

    it("allows authenticated users who are still onboarding to proceed", () => {
      const decision = evaluateOnboardingAccess({
        user: { id: "user-456" },
        profile: { onboarding_completed: false },
        draft: {},
        hasDraft: false,
      });
      expect(decision).toBe("allow");
    });
  });
});

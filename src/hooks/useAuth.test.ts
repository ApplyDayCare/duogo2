import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserProfile } from "@/contexts/AuthContext";

// Helper function that mirrors the profile completeness evaluation logic in AuthContext
export function evaluateIsProfileComplete(profile: Partial<UserProfile> | null): boolean {
  return Boolean(
    profile &&
    (
      Boolean(profile.onboarding_completed) ||
      Boolean(profile.privacy_consented) ||
      (
        Boolean(profile.first_name && profile.first_name.trim().length > 0) &&
        Boolean(profile.user_type) &&
        (
          Boolean(profile.quiz_completed) ||
          Boolean(profile.age_group) ||
          Boolean(profile.gender) ||
          Boolean(profile.location_city)
        )
      )
    )
  );
}

describe("useAuth Profile Completeness & Routing Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when profile is null", () => {
    expect(evaluateIsProfileComplete(null)).toBe(false);
  });

  it("should return true when onboarding_completed is true", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      email: "test@example.com",
      onboarding_completed: true,
    };
    expect(evaluateIsProfileComplete(profile)).toBe(true);
  });

  it("should return true when privacy_consented is true", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      first_name: "Alex",
      privacy_consented: true,
    };
    expect(evaluateIsProfileComplete(profile)).toBe(true);
  });

  it("should return false for partially completed profile missing user_type and quiz/location", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      first_name: "Alex",
      user_type: null,
      quiz_completed: false,
      onboarding_completed: false,
      privacy_consented: false,
    };
    expect(evaluateIsProfileComplete(profile)).toBe(false);
  });

  it("should return true when first_name, user_type, and quiz_completed are present", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      first_name: "Sam",
      user_type: "solo",
      quiz_completed: true,
      onboarding_completed: false,
    };
    expect(evaluateIsProfileComplete(profile)).toBe(true);
  });

  it("should return true when first_name, user_type, and age_group are present", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      first_name: "Jordan",
      user_type: "couple",
      age_group: "30-39",
    };
    expect(evaluateIsProfileComplete(profile)).toBe(true);
  });

  it("should return true when first_name, user_type, and location_city are present", () => {
    const profile: Partial<UserProfile> = {
      id: "user-123",
      first_name: "Taylor",
      user_type: "solo",
      location_city: "Milton",
    };
    expect(evaluateIsProfileComplete(profile)).toBe(true);
  });
});

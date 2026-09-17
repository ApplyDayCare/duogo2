import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSavedQuizAnswers, ensureUserQuizResponse } from "@/lib/quizSync";
import { saveOfflineProfile, getOfflineProfile } from "@/lib/queryPersister";
import { clearSignupDraft } from "@/lib/signupState";

export interface UserProfile {
  id: string;
  email?: string | null;
  first_name?: string | null;
  user_type?: "solo" | "couple" | string | null;
  location_city?: string | null;
  age_group?: string | null;
  gender?: string | null;
  quality_score?: number | null;
  quiz_completed?: boolean | null;
  onboarding_completed?: boolean | null;
  privacy_consented?: boolean | null;
  matching_paused?: boolean | null;
  is_suspended?: boolean | null;
  avatar_url?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isProfileComplete: boolean;
  refreshProfile: (targetUserId?: string) => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  isProfileComplete: false,
  refreshProfile: async () => null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, user_type, location_city, age_group, gender, quality_score, quiz_completed, onboarding_completed, privacy_consented, matching_paused, is_suspended, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Error fetching profile in AuthContext:", error);
        setProfile(null);
        return null;
      }

      let resolvedData = data as UserProfile | null;

      if (!resolvedData && userId) {
        // Automatically create missing profile row for this authenticated user so they are never stranded
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        const fallbackName = activeSession?.user?.email ? activeSession.user.email.split("@")[0] : "Member";
        const { data: createdData } = await supabase
          .from("profiles")
          .upsert({
            id: userId,
            email: activeSession?.user?.email || "",
            first_name: fallbackName,
            user_type: "solo",
            quiz_completed: true,
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .select("id, email, first_name, user_type, location_city, age_group, gender, quality_score, quiz_completed, onboarding_completed, privacy_consented, matching_paused, is_suspended, avatar_url")
          .maybeSingle();

        if (createdData) {
          resolvedData = createdData as UserProfile;
        } else {
          resolvedData = {
            id: userId,
            email: activeSession?.user?.email || "",
            first_name: fallbackName,
            user_type: "solo",
            quiz_completed: true,
            onboarding_completed: true,
          };
        }
      }

      if (resolvedData) {
        let quizDone = Boolean(resolvedData.quiz_completed);
        if (!quizDone) {
          const { data: qRow } = await supabase
            .from("quiz_responses")
            .select("dimension_1_social")
            .eq("user_id", userId)
            .maybeSingle();

          if (qRow && qRow.dimension_1_social !== null) {
            quizDone = true;
            resolvedData.quiz_completed = true;
            supabase.from("profiles").update({ quiz_completed: true }).eq("id", userId).then();
          } else {
            const saved = getSavedQuizAnswers(userId);
            if (saved && (saved.personalityChoice || Object.keys(saved.scaleAnswers || {}).length > 0)) {
              quizDone = true;
              resolvedData.quiz_completed = true;
              ensureUserQuizResponse(userId).then();
            }
          }
        }

        if (!resolvedData.onboarding_completed) {
          resolvedData.onboarding_completed = true;
          supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId).then();
        }

        // Auto-heal existing user profiles so logged-in users never get forced into signup flow again
        let updatedNeeded = false;
        const patch: Record<string, any> = {};

        if (!resolvedData.first_name || resolvedData.first_name.trim().length === 0) {
          const fallbackName = resolvedData.email?.split("@")[0] || "Member";
          resolvedData.first_name = fallbackName;
          patch.first_name = fallbackName;
          updatedNeeded = true;
        }
        if (!resolvedData.user_type) {
          resolvedData.user_type = "solo";
          patch.user_type = "solo";
          updatedNeeded = true;
        }
        if (!resolvedData.onboarding_completed) {
          resolvedData.onboarding_completed = true;
          patch.onboarding_completed = true;
          updatedNeeded = true;
        }
        if (!resolvedData.quiz_completed) {
          resolvedData.quiz_completed = true;
          patch.quiz_completed = true;
          updatedNeeded = true;
        }

        if (updatedNeeded) {
          supabase.from("profiles").update(patch).eq("id", userId).then();
        }
      }

      console.info("[AuthGuard:ProfileLoaded]", {
        userId,
        email: resolvedData?.email,
        firstName: resolvedData?.first_name,
        userType: resolvedData?.user_type,
        onboardingCompleted: resolvedData?.onboarding_completed,
        quizCompleted: resolvedData?.quiz_completed,
        privacyConsented: resolvedData?.privacy_consented,
      });

      if (resolvedData) {
        saveOfflineProfile(userId, resolvedData);
        clearSignupDraft();
      }

      setProfile(resolvedData);
      return resolvedData;
    } catch (err) {
      console.warn("Exception fetching profile in AuthContext, checking offline cache:", err);
      // Seamless offline recovery: check IndexedDB for stored profile
      const cached = await getOfflineProfile(userId);
      if (cached) {
        console.info("[AuthGuard:OfflineProfileLoaded]", cached);
        setProfile(cached as UserProfile);
        return cached as UserProfile;
      }
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (targetUserId?: string): Promise<UserProfile | null> => {
    let id = targetUserId || session?.user?.id;
    if (!id) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.id) {
          id = currentSession.user.id;
          setSession(currentSession);
        }
      } catch {
        // ignore
      }
    }
    if (!id) {
      setProfile(null);
      return null;
    }
    return await fetchProfile(id);
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (newSession?.user?.id) {
          fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false);
      if (initialSession?.user?.id) {
        fetchProfile(initialSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isProfileComplete = Boolean(
    profile &&
    (
      Boolean(profile.onboarding_completed) ||
      Boolean(profile.first_name && profile.first_name.trim().length > 0) ||
      Boolean(profile.id)
    )
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        profileLoading,
        isProfileComplete,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

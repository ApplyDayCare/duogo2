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
      let data: UserProfile | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      const delayMs = 300;

      while (attempts < maxAttempts) {
        attempts++;
        const { data: resData, error } = await supabase
          .from("profiles")
          .select("id, email, first_name, user_type, location_city, age_group, gender, quality_score, quiz_completed, onboarding_completed, privacy_consented, matching_paused, is_suspended, avatar_url")
          .eq("id", userId)
          .maybeSingle();

        if (!error && resData) {
          data = resData as UserProfile;
          break;
        }

        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      console.info("[AuthGuard:ProfileLoaded]", {
        userId,
        email: data?.email,
        firstName: data?.first_name,
        userType: data?.user_type,
        onboardingCompleted: data?.onboarding_completed,
        quizCompleted: data?.quiz_completed,
        privacyConsented: data?.privacy_consented,
      });

      if (data) {
        saveOfflineProfile(userId, data);
        if (data.onboarding_completed && data.quiz_completed) {
          clearSignupDraft();
        }
      }

      setProfile(data);
      return data;
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

import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { idbPersister } from "@/lib/queryPersister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { OnboardingStepGuard } from "@/components/OnboardingStepGuard";
import AppLayout from "@/components/AppLayout";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Resilient lazy loaded page components
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const AgeGroup = lazyWithRetry(() => import("./pages/onboarding/AgeGroup"));
const Gender = lazyWithRetry(() => import("./pages/onboarding/Gender"));
const Kids = lazyWithRetry(() => import("./pages/onboarding/Kids"));
const LookingFor = lazyWithRetry(() => import("./pages/onboarding/LookingFor"));
const UserType = lazyWithRetry(() => import("./pages/onboarding/UserType"));
const CoupleSetup = lazyWithRetry(() => import("./pages/onboarding/CoupleSetup"));
const SoloProfile = lazyWithRetry(() => import("./pages/onboarding/SoloProfile"));
const Location = lazyWithRetry(() => import("./pages/onboarding/Location"));
const Quiz = lazyWithRetry(() => import("./pages/Quiz"));
const PrivacyConsent = lazyWithRetry(() => import("./pages/onboarding/PrivacyConsent"));
const EmailVerification = lazyWithRetry(() => import("./pages/onboarding/EmailVerification"));
const Matches = lazyWithRetry(() => import("./pages/Matches"));
const MatchReveal = lazyWithRetry(() => import("./pages/MatchReveal"));
const MatchChat = lazyWithRetry(() => import("./pages/MatchChat"));
const Chats = lazyWithRetry(() => import("./pages/Chats"));
const PulseFeedback = lazyWithRetry(() => import("./pages/PulseFeedback"));
const PulseThankYou = lazyWithRetry(() => import("./pages/PulseThankYou"));
const Referral = lazyWithRetry(() => import("./pages/Referral"));
const JoinReferral = lazyWithRetry(() => import("./pages/JoinReferral"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const History = lazyWithRetry(() => import("./pages/History"));
const ReportMatch = lazyWithRetry(() => import("./pages/ReportMatch"));
const Safety = lazyWithRetry(() => import("./pages/Safety"));
const AdminReports = lazyWithRetry(() => import("./pages/AdminReports"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const About = lazyWithRetry(() => import("./pages/About"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days cache retention in IndexedDB
      staleTime: 1000 * 60 * 5, // 5 minutes before considering data stale
      networkMode: "offlineFirst", // Serve cache immediately if offline without throwing hard errors
      retry: (failureCount, error: any) => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: () => (typeof navigator !== "undefined" ? navigator.onLine : true),
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF5436] border-t-transparent" />
  </div>
);

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: idbPersister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days persistence
      buster: "duogo_cache_v1",
    }}
  >
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Toaster />
          <OfflineIndicator />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public Entry Points */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Navigate to="/?login=true" replace />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/join/:referralCode" element={<JoinReferral />} />

              {/* Progressive Signup & Onboarding Flow */}
              <Route path="/signup" element={<UserType />} />
              <Route path="/onboarding/user-type" element={<UserType />} />
              <Route path="/onboarding/age" element={<OnboardingStepGuard><AgeGroup /></OnboardingStepGuard>} />
              <Route path="/onboarding/gender" element={<OnboardingStepGuard><Gender /></OnboardingStepGuard>} />
              <Route path="/onboarding/kids" element={<OnboardingStepGuard><Kids /></OnboardingStepGuard>} />
              <Route path="/onboarding/looking-for" element={<OnboardingStepGuard><LookingFor /></OnboardingStepGuard>} />
              <Route path="/onboarding/couple-setup" element={<OnboardingStepGuard><CoupleSetup /></OnboardingStepGuard>} />
              <Route path="/onboarding/profile" element={<OnboardingStepGuard><SoloProfile /></OnboardingStepGuard>} />
              <Route path="/onboarding/location" element={<OnboardingStepGuard><Location /></OnboardingStepGuard>} />
              <Route path="/quiz" element={<OnboardingStepGuard><Quiz /></OnboardingStepGuard>} />
              <Route path="/onboarding/privacy-consent" element={<OnboardingStepGuard><PrivacyConsent /></OnboardingStepGuard>} />
              <Route path="/onboarding/verify" element={<OnboardingStepGuard><EmailVerification /></OnboardingStepGuard>} />

              {/* App pages with persistent navigation */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/chats" element={<Chats />} />
                <Route path="/match-reveal/:matchId" element={<MatchReveal />} />
                <Route path="/match/:matchId/chat" element={<MatchChat />} />
                <Route path="/referral" element={<Referral />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/pulse/thank-you" element={<PulseThankYou />} />
                <Route path="/pulse/:matchId" element={<PulseFeedback />} />
                <Route path="/report/:matchId" element={<ReportMatch />} />
                <Route path="/safety" element={<Safety />} />
              </Route>

              {/* Admin (no app layout) */}
              <Route path="/admin/reports" element={<AdminReports />} />

              {/* Public pages */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;

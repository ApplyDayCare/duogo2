import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Notifications from "./pages/Notifications";

// Lazy loaded page components
const Landing = lazy(() => import("./pages/Landing"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AgeGroup = lazy(() => import("./pages/onboarding/AgeGroup"));
const Gender = lazy(() => import("./pages/onboarding/Gender"));
const Kids = lazy(() => import("./pages/onboarding/Kids"));
const LookingFor = lazy(() => import("./pages/onboarding/LookingFor"));
const UserType = lazy(() => import("./pages/onboarding/UserType"));
const CoupleSetup = lazy(() => import("./pages/onboarding/CoupleSetup"));
const SoloProfile = lazy(() => import("./pages/onboarding/SoloProfile"));
const Location = lazy(() => import("./pages/onboarding/Location"));
const Quiz = lazy(() => import("./pages/Quiz"));
const PrivacyConsent = lazy(() => import("./pages/onboarding/PrivacyConsent"));
const EmailVerification = lazy(() => import("./pages/onboarding/EmailVerification"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchReveal = lazy(() => import("./pages/MatchReveal"));
const MatchChat = lazy(() => import("./pages/MatchChat"));
const Chats = lazy(() => import("./pages/Chats"));
const PulseFeedback = lazy(() => import("./pages/PulseFeedback"));
const PulseThankYou = lazy(() => import("./pages/PulseThankYou"));
const Referral = lazy(() => import("./pages/Referral"));
const JoinReferral = lazy(() => import("./pages/JoinReferral"));
const Profile = lazy(() => import("./pages/Profile"));
const History = lazy(() => import("./pages/History"));
const ReportMatch = lazy(() => import("./pages/ReportMatch"));
const Safety = lazy(() => import("./pages/Safety"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF5436] border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Toaster />
          <Sonner />
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
              <Route path="/onboarding/age" element={<AgeGroup />} />
              <Route path="/onboarding/gender" element={<Gender />} />
              <Route path="/onboarding/kids" element={<Kids />} />
              <Route path="/onboarding/looking-for" element={<LookingFor />} />
              <Route path="/onboarding/couple-setup" element={<CoupleSetup />} />
              <Route path="/onboarding/profile" element={<SoloProfile />} />
              <Route path="/onboarding/location" element={<Location />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/onboarding/privacy-consent" element={<PrivacyConsent />} />
              <Route path="/onboarding/verify" element={<EmailVerification />} />

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
  </QueryClientProvider>
);

export default App;

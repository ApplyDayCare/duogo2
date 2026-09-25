import { useState, useEffect, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { updateSignupDraft } from "@/lib/signupState";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mail,
  Check,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Lock,
  Compass,
  Users,
  Handshake,
  KeyRound,
  Loader2,
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import cafeLifestyleImg from "@/assets/images/friends_cafe_lifestyle_1788440191022.jpg";
import parkWalkImg from "@/assets/images/friends_park_walk_1788440206700.jpg";
import dinnerChatImg from "@/assets/images/friends_dinner_chat_1788440227145.jpg";

export default function Landing() {
  const { session, user, profile, isProfileComplete, loading: authLoading, profileLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"solo" | "couples">("solo");
  const [email, setEmail] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [loginCode, setLoginCode] = useState("");
  const [verifyingLogin, setVerifyingLogin] = useState(false);
  const [loginCooldown, setLoginCooldown] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "true") {
        setShowLogin(true);
      }
    }
  }, []);

  const startLoginCooldown = () => {
    setLoginCooldown(30);
    const timer = setInterval(() => {
      setLoginCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getLoggedInDestination = useCallback(() => {
    if (profile || isProfileComplete) {
      return "/dashboard";
    }
    return "/dashboard";
  }, [isProfileComplete, profile]);

  // Seamless transition: If a user launches the PWA from Home Screen or visits "/" while authenticated,
  // automatically forward them to their dashboard or resume their current onboarding step.
  // CRITICAL: We MUST wait until profileLoading is false so we do not prematurely redirect to step 1
  // when an existing user's profile is still being fetched over the network.
  // We also DO NOT redirect if the user explicitly opened the login modal (?login=true).
  useEffect(() => {
    if (authLoading || profileLoading) return;

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const isLoginRequested = params?.get("login") === "true" || showLogin;

    if (session && !isLoginRequested) {
      navigate(getLoggedInDestination(), { replace: true });
    }
  }, [authLoading, profileLoading, session, showLogin, getLoggedInDestination, navigate]);

  const handleStartSignup = (type?: "solo" | "couple") => {
    if (session) {
      navigate(getLoggedInDestination());
      return;
    }
    if (type) {
      navigate(`/onboarding/user-type?type=${type}`);
    } else {
      navigate("/onboarding/user-type");
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setLoginError(null);

    // CRITICAL: shouldCreateUser: false ensures users who have not signed up cannot bypass onboarding
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSending(false);

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("rate") || msg.includes("too many")) {
        setLoginError("Too many attempts. Please wait a moment before trying again.");
        toast({
          title: "Please wait",
          description: "Too many attempts. Please wait a moment before trying again.",
          variant: "destructive",
        });
      } else {
        // Any other error during login for an unregistered email or new user attempt
        setLoginError("new_user");
        toast({
          title: "Are you new here?",
          description: "Sign up to take the compatibility quiz and get started.",
        });
      }
    } else {
      setLoginStep("code");
      startLoginCooldown();
      toast({
        title: "Code sent! 📬",
        description: `Check ${email.trim()} for your 6-digit one-time code.`,
      });
    }
  };

  const handleVerifyLoginCode = async (codeToVerify?: string) => {
    const token = (codeToVerify || loginCode).trim();
    if (!token || token.length < 6 || !email.trim()) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code sent to your email.",
        variant: "destructive",
      });
      return;
    }
    setVerifyingLogin(true);
    let { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (error && error.message?.toLowerCase().includes("type")) {
      const retry = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "signup",
      });
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }
    setVerifyingLogin(false);
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
    } else if (data.session?.user) {
      setShowLogin(false);
      if (typeof window !== "undefined" && window.location.search.includes("login=true")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const verifiedUserId = data.session.user.id;

      // Fetch the updated profile via refreshProfile with explicit verifiedUserId
      let loadedProfile = await refreshProfile(verifiedUserId);

      // Direct Supabase query fallback to guarantee profile recovery even before state propagation
      if (!loadedProfile) {
        const { data: directProfile } = await supabase
          .from("profiles")
          .select("id, email, first_name, user_type, location_city, age_group, gender, quality_score, quiz_completed, onboarding_completed, privacy_consented, matching_paused, is_suspended, avatar_url")
          .eq("id", verifiedUserId)
          .maybeSingle();
        if (directProfile) {
          loadedProfile = directProfile as UserProfile;
        }
      }

      const isComplete = Boolean(
        loadedProfile &&
        (
          Boolean(loadedProfile.onboarding_completed) ||
          Boolean(loadedProfile.quiz_completed) ||
          Boolean(loadedProfile.first_name && loadedProfile.first_name.trim().length > 0) ||
          (
            Boolean(loadedProfile.first_name && loadedProfile.first_name.trim().length > 0) &&
            Boolean(loadedProfile.user_type) &&
            Boolean(loadedProfile.location_city) &&
            Boolean(loadedProfile.quiz_completed) &&
            Boolean(loadedProfile.privacy_consented)
          )
        )
      );

      if (isComplete) {
        toast({
          title: "Welcome back! ✦",
          description: "Signed in successfully.",
        });
        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "Welcome back! ✦",
          description: "Let's complete your profile setup.",
        });
        if (!loadedProfile?.user_type) {
          navigate("/onboarding/user-type", { replace: true });
        } else if (!loadedProfile?.first_name) {
          navigate(loadedProfile.user_type === "couple" ? "/onboarding/couple-setup" : "/onboarding/profile", { replace: true });
        } else if (!loadedProfile?.quiz_completed) {
          navigate("/quiz", { replace: true });
        } else {
          navigate("/onboarding/privacy-consent", { replace: true });
        }
      }
    }
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistEmail.includes("@")) {
      toast({
        title: "Please enter a valid email",
        description: "We'll notify you as soon as your neighborhood unlocks.",
        variant: "destructive",
      });
      return;
    }
    setWaitlistSuccess(true);
    toast({
      title: "You're on the waitlist! ✦",
      description: `We've saved ${waitlistEmail}. You'll be notified as soon as a compatible match is found.`,
    });
  };

  return (
    <div
      style={{
        ["--cream" as string]: "#F6F1E6",
        ["--cream-dim" as string]: "#EFE6D2",
        ["--ink" as string]: "#1A1A1A",
        ["--ink-soft" as string]: "#5C5548",
        ["--coral-1" as string]: "#FFB79E",
        ["--coral-2" as string]: "#FF6F5E",
        ["--mint-1" as string]: "#D3F1DE",
        ["--mint-2" as string]: "#77CBA6",
        ["--butter-1" as string]: "#FCE79A",
        ["--butter-2" as string]: "#F2CE55",
        ["--line" as string]: "rgba(26,26,26,0.10)",
      }}
      className="min-h-screen bg-[var(--cream)] text-[var(--ink)] font-['Inter',sans-serif] text-[16px] leading-[1.6] antialiased selection:bg-[#FFB79E] selection:text-[#1A1A1A]"
    >
      {/* ---------- HEADER ---------- */}
      <header className="sticky top-0 z-30 bg-[#F6F1E6]/90 backdrop-blur-md border-b border-[var(--line)]">
        <nav className="flex items-center justify-between py-[20px] px-6 sm:px-8 max-w-[1180px] mx-auto">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="font-['Fraunces',serif] text-[24px] font-bold tracking-tight text-[var(--ink)] hover:opacity-90 transition-opacity"
            >
              duogo<span className="text-[var(--coral-2)]">.</span>
            </button>
            <div
              className="w-[34px] h-[34px] rounded-full bg-[var(--cream-dim)] flex items-center justify-center gap-[3px]"
              aria-hidden="true"
            >
              <i className="w-[4px] h-[4px] rounded-full bg-[var(--ink-soft)] block" />
              <i className="w-[4px] h-[4px] rounded-full bg-[var(--ink-soft)] block" />
            </div>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-7 text-[14.5px] font-medium text-[var(--ink-soft)]">
            <a href="#about" className="hover:text-[var(--coral-2)] transition-colors">
              Find your people
            </a>
            <a href="#how" className="hover:text-[var(--coral-2)] transition-colors">
              How it works
            </a>
            <a href="#modes" className="hover:text-[var(--coral-2)] transition-colors">
              Ways to connect
            </a>
            <a href="#radar" className="hover:text-[var(--coral-2)] transition-colors">
              Compatibility
            </a>
            <a href="#safety" className="hover:text-[var(--coral-2)] transition-colors">
              Privacy
            </a>
            <a href="#faq" className="hover:text-[var(--coral-2)] transition-colors">
              FAQ
            </a>
          </div>

          {/* Nav right actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {session ? (
              <>
                <button
                  onClick={() => signOut()}
                  className="font-medium text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  Log out
                </button>
                <button
                  onClick={() => navigate(getLoggedInDestination())}
                  className="inline-flex items-center justify-center gap-1.5 px-[20px] py-[10px] sm:px-[24px] sm:py-[12px] rounded-full font-bold text-[14.5px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                    color: "var(--ink)",
                  }}
                >
                  <span>{isProfileComplete ? "Dashboard" : "Resume Setup"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  className="font-semibold text-[15px] text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => handleStartSignup()}
                  className="inline-flex items-center justify-center gap-2 px-[26px] py-[13px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                    color: "var(--ink)",
                  }}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- 1. HERO SECTION ---------- */}
      <section className="pt-6 pb-12">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div
            className="rounded-[36px] relative overflow-hidden min-h-[460px] sm:min-h-[490px] lg:min-h-[510px] p-7 sm:p-10 lg:p-12 flex flex-col justify-between border border-[var(--line)] shadow-xl text-white bg-[#1A1A1A]"
          >
            {/* Background lifestyle photo with real human connection */}
            <div className="absolute inset-0 z-0">
              <img
                src={cafeLifestyleImg}
                alt="Diverse friends connecting and laughing at an outdoor cafe"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[center_30%] scale-105 filter brightness-[0.96]"
              />
              {/* Dual gradient overlay for high contrast and readability */}
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    linear-gradient(90deg, rgba(20,18,16,0.95) 0%, rgba(20,18,16,0.86) 48%, rgba(20,18,16,0.35) 82%, rgba(20,18,16,0.18) 100%),
                    linear-gradient(0deg, rgba(20,18,16,0.92) 0%, rgba(20,18,16,0.40) 50%, transparent 80%)
                  `,
                }}
              />
            </div>

            {/* Top Badge */}
            <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[12px] font-semibold tracking-wide uppercase text-white/95 border border-white/20 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[var(--coral-2)] animate-pulse" />
                Intentional Introductions · Real Connections
              </div>
            </div>

            {/* Hero Copy */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-end pt-10 sm:pt-14">
              <div className="max-w-2xl">
                <h1 className="font-['Fraunces',serif] text-[32px] sm:text-[44px] lg:text-[50px] text-white font-semibold leading-[1.12] tracking-[-0.02em]">
                  Making friends shouldn&apos;t be this hard.
                </h1>
                <p className="font-['Fraunces',serif] text-[20px] sm:text-[23px] text-[var(--coral-1)] italic mt-2.5 font-normal">
                  Meet people who actually fit your personality and lifestyle.
                </p>
                <p className="text-white/85 text-[15.5px] sm:text-[17px] mt-4 leading-relaxed max-w-[52ch]">
                  We match you with people nearby based on personality, values, and interests—so conversations feel natural from the start.
                </p>

                <div className="mt-7 flex items-center gap-4 flex-wrap">
                  <button
                    onClick={() => handleStartSignup()}
                    className="inline-flex items-center justify-center gap-2 px-[28px] py-[14px] rounded-full font-bold text-[16px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-lg text-[var(--ink)]"
                    style={{
                      background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                    }}
                  >
                    <span>
                      {session
                        ? isProfileComplete
                          ? "Go to Dashboard"
                          : "Resume Setup"
                        : "Find Your People"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a
                    href="#how"
                    className="inline-flex items-center gap-1.5 font-semibold text-[14.5px] text-white/85 hover:text-white transition-colors py-2 px-3"
                  >
                    How it works
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Floating Real Match Preview */}
              <div className="hidden lg:flex flex-col gap-3 items-end">
                <div className="bg-white/95 backdrop-blur-md text-[var(--ink)] p-4 rounded-[22px] shadow-2xl border border-white/40 max-w-[300px] transition-transform hover:-translate-y-1 duration-200">
                  <div className="flex items-center gap-3">
                    <img
                      src={parkWalkImg}
                      alt="Maya & Sam"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[var(--coral-2)]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--mint-2)] inline-block" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Intentional Intro
                        </span>
                      </div>
                      <div className="font-['Fraunces',serif] font-semibold text-[15px] text-[var(--ink)]">
                        Maya &amp; Sam
                      </div>
                      <div className="text-[12px] text-[var(--ink-soft)]">
                        Trail hikes &amp; pour-over coffee
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[11.5px] font-bold">
                    <span className="text-[var(--coral-2)]">92% Lifestyle Alignment</span>
                    <span className="bg-[var(--mint-1)] text-[#123022] px-2.5 py-0.5 rounded-full">Matched</span>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md text-[var(--ink)] py-2 px-4 rounded-full shadow-lg border border-white/30 text-[12.5px] font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--mint-2)] animate-pulse" />
                  <span>One meaningful introduction at a time</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2. FIND YOUR PEOPLE SECTION ---------- */}
      <section id="about" className="py-16 sm:py-20 bg-[var(--cream)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 sm:gap-14 items-center">
            {/* Left Copy */}
            <div>
              <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
                Quality Over Quantity
              </div>
              <h2 className="font-['Fraunces',serif] font-semibold text-[36px] sm:text-[46px] lg:text-[52px] leading-[1.1] text-[var(--ink)] tracking-[-0.02em]">
                Friendship isn&apos;t a{" "}
                <span className="italic font-medium text-[var(--coral-2)]">numbers game.</span>
              </h2>

              <p className="mt-4 font-['Fraunces',serif] text-[20px] sm:text-[22px] text-[var(--ink)] font-normal">
                That&apos;s why we focus on one meaningful match at a time.
              </p>

              <p className="mt-4 text-[16px] sm:text-[17.5px] text-[var(--ink-soft)] leading-relaxed font-normal max-w-[48ch]">
                Most other friendship apps overwhelm you with endless profiles. We slow things down and focus on quality connections that have a real chance of becoming lasting friendships.
              </p>

              {/* Supporting Pillars */}
              <div className="mt-8 pt-6 border-t border-[var(--line)] grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-[var(--line)] shadow-2xs">
                  <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[var(--ink)]">
                    Slow down the scroll
                  </h3>
                  <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
                    No infinite catalogs or decision fatigue. Receive intentional introductions so you can invest in someone with real potential.
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[var(--line)] shadow-2xs">
                  <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[var(--ink)]">
                    Purely Platonic
                  </h3>
                  <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
                    Built specifically for friendship with zero romantic pressure, no mixed signals, and respectful community standards.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Mockup Showcase */}
            <div aria-hidden="true" className="w-full relative">
              {/* Phone Device Frame */}
              <div className="bg-white rounded-[34px] p-4 pb-5 shadow-[0_24px_50px_rgba(26,26,26,0.12)] max-w-[330px] mx-auto border border-[var(--line)] relative z-10">
                <div className="flex justify-between text-[12px] font-bold px-2 pt-1 pb-3 text-[var(--ink-soft)]">
                  <span>Intentional Intro</span>
                  <span>5G ▮▮▮</span>
                </div>

                {/* Notification Card */}
                <div className="rounded-[20px] p-4 mb-3 bg-[var(--cream-dim)]">
                  <div className="text-[11px] font-bold tracking-[0.04em] uppercase text-[var(--coral-2)]">
                    Curated Introduction
                  </div>
                  <h3 className="font-['Fraunces',serif] font-semibold text-[18px] mt-1 text-[var(--ink)]">
                    Someone new nearby (5 km)
                  </h3>
                  <div className="text-[12.5px] text-[var(--ink-soft)] mt-1.5 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[var(--mint-2)] inline-block" />
                    High lifestyle &amp; value compatibility
                  </div>
                </div>

                {/* Compatibility Highlights */}
                <div
                  className="rounded-[20px] p-4 mb-3"
                  style={{
                    background: "linear-gradient(135deg, var(--mint-1), var(--mint-2))",
                  }}
                >
                  <div className="flex justify-between items-center text-[#143024]">
                    <strong className="text-[14px]">Why you matched</strong>
                    <span className="text-[13px]">✦</span>
                  </div>
                  <p className="text-[13px] mt-2 text-[#143024] leading-snug">
                    You both chose third-wave coffee shops, scenic weekend trail hikes, and dry conversational humor.
                  </p>
                  <div className="mt-2.5 flex gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold bg-white/75 px-2.5 py-0.5 rounded-full text-[#143024]">
                      Trail hiking
                    </span>
                    <span className="text-[11px] font-bold bg-white/75 px-2.5 py-0.5 rounded-full text-[#143024]">
                      Specialty coffee
                    </span>
                    <span className="text-[11px] font-bold bg-white/75 px-2.5 py-0.5 rounded-full text-[#143024]">
                      Board games
                    </span>
                  </div>
                </div>

                {/* Status Card */}
                <div className="rounded-[20px] p-3.5 bg-white border border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={parkWalkImg}
                        alt="Maya"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-[var(--coral-2)] shadow-xs"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--mint-2)] border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-['Fraunces',serif] font-semibold text-[14.5px] text-[var(--ink)] leading-tight">
                        Maya, 29
                      </h3>
                      <p className="text-[11.5px] text-[var(--ink-soft)]">
                        Mutual Connect • Chat open
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 3. HOW IT WORKS ---------- */}
      <section id="how" className="py-20 sm:py-24 bg-white border-b border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[58ch] mx-auto text-center mb-14">
            <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
              Intentional Process
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[32px] sm:text-[40px] text-[var(--ink)] tracking-[-0.01em]">
              How It Works
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] text-[16.5px]">
              Three thoughtful steps from discovering common ground to building lasting real-world friendships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-[var(--cream)] rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-2xs">
              <div className="text-[12px] font-bold tracking-wider text-[var(--coral-2)] uppercase">
                Step 01
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[var(--ink)] mt-2">
                1. Tell us what matters to you
              </h3>
              <p className="mt-3 text-[var(--ink-soft)] text-[15px] leading-relaxed">
                Share your personality, interests, values, and what you&apos;re looking for in a friendship.
              </p>
              <div className="flex gap-2.5 my-4.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#FFE3D9]" title="Conversation Depth">
                  💬
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#DDF3E6]" title="Energy & Outdoor Pace">
                  🥾
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#FFF1C9]" title="Social Battery & Values">
                  ☕
                </div>
              </div>
              <p className="text-[var(--ink-soft)] text-[13px] leading-relaxed mt-auto pt-2 border-t border-[var(--line)]">
                Calibrates social battery, conversational cadence, free-time hobbies, and core values.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-2xs"
              style={{
                background: "linear-gradient(160deg, var(--mint-1), var(--mint-2))",
              }}
            >
              <div className="text-[12px] font-bold tracking-wider text-[#143024] uppercase">
                Step 02 · One Match At A Time
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[#143024] mt-2">
                2. Meet someone you&apos;ll actually connect with
              </h3>
              <p className="mt-3 text-[#143024] text-[15px] leading-relaxed">
                Get thoughtfully matched with someone whose personality and lifestyle complement yours.
              </p>
              <div className="flex mt-auto pt-5">
                <div className="w-16 h-[74px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] p-1.5 overflow-hidden relative">
                  <img
                    src={parkWalkImg}
                    alt="Blurred for privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
                <div className="w-16 h-[74px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] -ml-4 p-1.5 overflow-hidden relative">
                  <img
                    src={cafeLifestyleImg}
                    alt="Blurred for privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
                <div className="w-16 h-[74px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] -ml-4 p-1.5 overflow-hidden relative">
                  <img
                    src={dinnerChatImg}
                    alt="Blurred for privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[var(--cream)] rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-2xs">
              <div className="text-[12px] font-bold tracking-wider text-[var(--coral-2)] uppercase">
                Step 03
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[var(--ink)] mt-2">
                3. Turn a match into a real friendship
              </h3>
              <p className="mt-3 text-[var(--ink-soft)] text-[15px] leading-relaxed">
                You have 15 days to take the conversation offline. Start a chat, suggest a coffee or a walk, and meet in person. If you don&apos;t meet within 15 days, the connection quietly expires. No endless texting, no wasted time.
              </p>
              <div className="flex items-center mt-auto pt-5 gap-2">
                <div className="flex -space-x-2.5">
                  <img
                    src={parkWalkImg}
                    alt="Unlocked member profile"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                  <img
                    src={dinnerChatImg}
                    alt="Unlocked member profile"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                  <img
                    src={cafeLifestyleImg}
                    alt="Unlocked member profile"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                </div>
                <div className="text-[12px] font-bold text-[var(--ink)] pl-1.5">
                  <span className="text-[var(--mint-2)] font-black text-sm">✓</span> Chat unlocked
                </div>
              </div>
            </div>
          </div>

          {/* Center CTA */}
          <div className="text-center mt-12">
            <button
              onClick={() => handleStartSignup()}
              className="inline-flex items-center justify-center gap-2 px-[28px] py-[14px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 text-[var(--ink)] shadow-xs"
              style={{
                background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
              }}
            >
              <span>Take the friendship quiz</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ---------- THE 15-DAY RULE ---------- */}
      <section className="py-20 sm:py-24 bg-[var(--cream)] border-b border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[66ch] mx-auto text-center">
            <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
              The 15-Day Rule
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[30px] sm:text-[38px] text-[var(--ink)] tracking-[-0.01em] leading-tight">
              From Screen to Street in 15 Days.
            </h2>
            <p className="mt-4 font-['Fraunces',serif] text-[19px] sm:text-[21px] text-[var(--ink)] font-normal">
              We don&apos;t do endless pen pals. We do real-life meetups.
            </p>
            <p className="mt-4 text-[var(--ink-soft)] text-[16px] sm:text-[17px] leading-relaxed">
              The biggest enemy of adult friendship isn&apos;t rejection—it&apos;s inertia. The endless &ldquo;we should totally hang out sometime&rdquo; that never actually happens. That’s why duogo has a built-in 15-day meeting window. Once you match, the clock starts. We give you two weeks to move from chatting to a real-world meetup. If you don&apos;t meet, the connection expires, and you won&apos;t be matched again. It&apos;s not a threat; it&apos;s a gentle push. It protects your time, filters out time-wasters, and ensures that every connection on duogo is serious about actually showing up.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 4. DIFFERENTIATION (PLACED IMMEDIATELY AFTER HOW IT WORKS) ---------- */}
      <section className="py-20 sm:py-24 bg-[var(--cream-dim)] border-b border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[62ch] mx-auto text-center mb-14">
            <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
              Built for Friendship
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[30px] sm:text-[38px] text-[var(--ink)] tracking-[-0.01em] leading-tight">
              This isn&apos;t a dating app wearing a friendship costume.
            </h2>
            <p className="mt-4 font-['Fraunces',serif] text-[19px] sm:text-[21px] text-[var(--ink)] font-normal">
              duogo is built specifically for friendship—not dating, flirting, or collecting matches.
            </p>
            <p className="mt-3 text-[var(--ink-soft)] text-[16px] sm:text-[17px] leading-relaxed">
              No swiping for attention. No pressure to perform. Just intentional introductions designed to help you find people you genuinely connect with.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                01
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                Platonic by Design
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                We are gender-blind and strictly platonic. Zero romantic pressure and no mixed signals. Romantic solicitations are strictly prohibited.
              </p>
            </div>

            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                02
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                One Match at a Time
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                No infinite scrolling or superficial swipes. We alert you when a truly compatible match is found so you can invest in a real connection.
              </p>
            </div>

            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                03
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                Zero Rejection Sting
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                Decisions are double-blind. If both people don&apos;t connect, the introduction quietly expires without awkward notifications or hurt feelings.
              </p>
            </div>

            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                04
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                Time-Respecting Design
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                We cap connections at 15 days. This isn&apos;t a place to collect matches or build a roster of pen pals. It&apos;s a launchpad for real-world friendships. If you aren&apos;t ready to meet in person, you aren&apos;t ready for duogo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 5. WAYS TO CONNECT (MODES: SOLO & COUPLES) ---------- */}
      <section id="modes" className="py-20 sm:py-24 bg-white border-b border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[62ch] mx-auto text-center mb-11">
            <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
              Flexible Formats
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[30px] sm:text-[38px] text-[var(--ink)] tracking-[-0.01em]">
              One-on-one or small groups, matched properly.
            </h2>
            <p className="mt-3.5 text-[var(--ink-soft)] text-[16px] sm:text-[17px] leading-relaxed">
              Whether you prefer one-on-one coffee chats, outdoor adventures, or group activities, duogo helps you connect. Choose Solo mode for individual matches, or Couples Mode for two friends or couples looking to expand their social circle platonically.
            </p>
          </div>

          {/* Toggle pill */}
          <div
            className="flex gap-1 bg-white p-1.5 rounded-full w-max mx-auto mb-10 shadow-[0_6px_18px_rgba(26,26,26,0.06)] border border-[var(--line)]"
            role="tablist"
          >
            <button
              onClick={() => setActiveTab("solo")}
              role="tab"
              aria-selected={activeTab === "solo"}
              className={`font-['Inter',sans-serif] font-bold text-[14.5px] border-none cursor-pointer py-2.5 px-6 rounded-full transition-all duration-200 ${
                activeTab === "solo"
                  ? "bg-[var(--ink)] text-white shadow-xs"
                  : "bg-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Solo mode
            </button>
            <button
              onClick={() => setActiveTab("couples")}
              role="tab"
              aria-selected={activeTab === "couples"}
              className={`font-['Inter',sans-serif] font-bold text-[14.5px] border-none cursor-pointer py-2.5 px-6 rounded-full transition-all duration-200 ${
                activeTab === "couples"
                  ? "bg-[var(--ink)] text-white shadow-xs"
                  : "bg-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Couples mode
            </button>
          </div>

          {/* Panel Solo */}
          {activeTab === "solo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
              <div className="space-y-3.5">
                <h3 className="font-['Fraunces',serif] font-semibold text-[25px] text-[var(--ink)] mb-3.5">
                  One-on-one, matched properly
                </h3>
                <p className="text-[var(--ink-soft)] max-w-[46ch] text-[15px] leading-relaxed">
                  For people who want a genuine companion for the things they love doing, not an inactive group chat that never schedules a meetup.
                </p>
                <div className="mt-4.5 flex flex-col gap-2.5">
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Unhurried third-wave cafes &amp; specialty coffee tastings
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Bruce Trail escarpment hikes, Rouge Park loops &amp; walks
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    AGO exhibitions, indie cinema screenings &amp; live concerts
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Casual bouldering, rec league tennis &amp; run clubs
                  </div>
                </div>
                <div className="pt-3">
                  <button
                    onClick={() => handleStartSignup("solo")}
                    className="inline-flex items-center gap-2 text-[14.5px] font-bold text-[var(--coral-2)] hover:underline"
                  >
                    <span>Start as a Solo Explorer</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_12px_28px_rgba(26,26,26,0.06)] border border-[var(--line)] overflow-hidden">
                <div className="relative rounded-[20px] overflow-hidden aspect-[4/3] max-h-[260px]">
                  <img
                    src={parkWalkImg}
                    alt="Two friends walking along Bruce Trail"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                    <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold w-fit mb-1 border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-[var(--coral-2)]" />
                      Solo Explorer Match
                    </div>
                    <div className="font-['Fraunces',serif] font-semibold text-[17px]">
                      Weekend Coffee &amp; Bruce Trail Hike
                    </div>
                    <div className="text-[12.5px] text-white/80 mt-0.5">
                      92% compatibility · Same conversational pace
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel Couples */}
          {activeTab === "couples" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
              <div className="space-y-3.5">
                <h3 className="font-['Fraunces',serif] font-semibold text-[25px] text-[var(--ink)] mb-3.5">
                  Two by two, without the awkwardness
                </h3>
                <p className="text-[var(--ink-soft)] max-w-[46ch] text-[15px] leading-relaxed">
                  Take the quiz, share an invite link with your partner to connect your accounts, and get matched 2-on-2 with another couple whose conversational depth, food curiosity, and weekend rhythms mirror yours.
                </p>
                <div className="mt-4.5 flex flex-col gap-2.5">
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Double dates without the stiff, interview-style pressure
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Game nights &amp; trivia matched on conversational banter
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Weekend dinner parties, backyard cookouts &amp; patio hops
                  </div>
                  <div className="text-[14.5px] text-[var(--ink-soft)] pl-6 relative font-semibold before:content-['•'] before:absolute before:left-0 before:text-[var(--coral-2)]">
                    Weekend getaways &amp; scenic day trips
                  </div>
                </div>
                <div className="pt-3">
                  <button
                    onClick={() => handleStartSignup("couple")}
                    className="inline-flex items-center gap-2 text-[14.5px] font-bold text-[var(--coral-2)] hover:underline"
                  >
                    <span>Start as a Couple</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-[26px] p-4 sm:p-5 shadow-[0_12px_28px_rgba(26,26,26,0.06)] border border-[var(--line)] overflow-hidden">
                <div className="relative rounded-[20px] overflow-hidden aspect-[4/3] max-h-[260px]">
                  <img
                    src={dinnerChatImg}
                    alt="Two couples enjoying dinner and game night together"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                    <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold w-fit mb-1 border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-[var(--mint-2)]" />
                      Couples Double-Date Match
                    </div>
                    <div className="font-['Fraunces',serif] font-semibold text-[17px]">
                      Backyard Dinner &amp; Trivia Banter
                    </div>
                    <div className="text-[12.5px] text-white/80 mt-0.5">
                      Matched on food curiosity &amp; weekend rhythm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- 6. COMPATIBILITY (RADAR & DIMENSIONS) ---------- */}
      <section id="radar" className="py-20 sm:py-24 bg-[var(--cream)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-12 items-center">
            <div>
              <div className="max-w-[56ch]">
                <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
                  Shared Foundations
                </div>
                <h2 className="font-['Fraunces',serif] font-semibold text-[30px] sm:text-[38px] text-[var(--ink)] tracking-[-0.01em] leading-tight">
                  A great friendship starts with something in common.
                </h2>
                <p className="mt-3.5 text-[var(--ink-soft)] text-[16.5px] leading-relaxed">
                  See what you already share—and where you complement each other—before you meet.
                </p>
                <p className="mt-2.5 text-[var(--ink-soft)] text-[15px] leading-relaxed">
                  Every introduction comes with a compatibility radar mapping five core lifestyle dimensions scored directly from your quiz answers so conversations feel effortless from day one.
                </p>
              </div>
              <div className="flex gap-6 mt-6 text-[14px] font-bold">
                <span className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full mr-2 bg-[var(--coral-2)]" />
                  Your Profile
                </span>
                <span className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-full mr-2 bg-[var(--mint-2)]" />
                  Your Introduction
                </span>
              </div>
            </div>

            <div className="bg-white rounded-[28px] p-6 sm:p-7 shadow-[0_14px_32px_rgba(26,26,26,0.07)] border border-[var(--line)] max-w-md mx-auto w-full">
              <svg
                viewBox="0 0 300 300"
                width="100%"
                role="img"
                aria-label="Radar chart comparing five lifestyle dimensions between two matched users"
                className="w-full h-auto overflow-visible"
              >
                {/* Concentric pentagon rings */}
                <polygon
                  points="150,30 264,113 220,247 80,247 36,113"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="1.5"
                />
                <polygon
                  points="150,90 207,132 185,199 115,199 93,132"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="1.5"
                />

                {/* Spokes from center */}
                <line x1="150" y1="150" x2="150" y2="30" stroke="var(--line)" />
                <line x1="150" y1="150" x2="264" y2="113" stroke="var(--line)" />
                <line x1="150" y1="150" x2="220" y2="247" stroke="var(--line)" />
                <line x1="150" y1="150" x2="80" y2="247" stroke="var(--line)" />
                <line x1="150" y1="150" x2="36" y2="113" stroke="var(--line)" />

                {/* You Polygon (Coral) */}
                <polygon
                  points="150,60 213,130 210,233 108,208 59,120"
                  fill="var(--coral-2)"
                  fillOpacity="0.25"
                  stroke="var(--coral-2)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />

                {/* Match Polygon (Mint) */}
                <polygon
                  points="150,66 224,126 203,223 101,218 53,119"
                  fill="var(--mint-2)"
                  fillOpacity="0.28"
                  stroke="var(--mint-2)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />

                {/* Labels */}
                <text
                  x="150"
                  y="20"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  Social Energy
                </text>
                <text
                  x="274"
                  y="110"
                  textAnchor="start"
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  Conversation Depth
                </text>
                <text
                  x="222"
                  y="270"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  Active vs Relaxing
                </text>
                <text
                  x="78"
                  y="270"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  Hangout Budget
                </text>
                <text
                  x="26"
                  y="110"
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  Spontaneity &amp; Plans
                </text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 7. PRIVACY & SAFETY SECTION ---------- */}
      <div id="safety" className="px-5 sm:px-8 py-10 sm:py-14 bg-white">
        <section
          className="rounded-[40px] py-16 sm:py-20 px-6 sm:px-12 max-w-[1130px] mx-auto text-[var(--cream)] shadow-xl"
          style={{ background: "var(--ink)" }}
        >
          <div className="max-w-[60ch] mx-auto text-center mb-12">
            <div className="text-[12.5px] font-bold uppercase tracking-widest text-[var(--coral-1)] mb-2.5">
              Protected by Design
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[30px] sm:text-[38px] text-[var(--cream)] tracking-[-0.01em]">
              Privacy is the default, not a buried setting
            </h2>
            <p className="mt-3.5 text-[var(--cream)]/85 text-[17px] sm:text-[18px] font-medium">
              You decide what to share, when to share it, and with whom.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-[var(--cream)]/6 rounded-[22px] p-6.5 border border-[var(--cream)]/10">
              <div className="flex items-center gap-2.5 mb-2.5 text-[var(--coral-1)]">
                <Lock className="h-5 w-5" />
                <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--cream)]">
                  Double-Blind by Design
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                Neither person sees photos or personal social handles until both tap Connect. If either passes, the decision stays 100% confidential. No rejection notices, no awkwardness.
              </p>
            </div>
            <div className="bg-[var(--cream)]/6 rounded-[22px] p-6.5 border border-[var(--cream)]/10">
              <div className="flex items-center gap-2.5 mb-2.5 text-[var(--mint-2)]">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--cream)]">
                  Verified Social Accountability
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                Every applicant provides a real, public social link (Instagram, LinkedIn, or portfolio) to prevent catfishing, eliminate bots, and ensure genuine human accountability.
              </p>
            </div>
            <div className="bg-[var(--cream)]/6 rounded-[22px] p-6.5 border border-[var(--cream)]/10">
              <div className="flex items-center gap-2.5 mb-2.5 text-[#FBBF24]">
                <Users className="h-5 w-5" />
                <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--cream)]">
                  Strictly Non-Romantic Code
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                duogo is 100% platonic and gender-blind. Romantic solicitations, predatory behavior, or harassment result in permanent removal. Built-in reporting and 1-tap blocking are accessible 24/7.
              </p>
            </div>
            <div className="bg-[var(--cream)]/6 rounded-[22px] p-6.5 border border-[var(--cream)]/10">
              <div className="flex items-center gap-2.5 mb-2.5 text-[var(--coral-1)]">
                <Handshake className="h-5 w-5" />
                <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--cream)]">
                  Post-Hangout Pulse Checks
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                After meeting up, members complete a brief in-app pulse check to verify safety, punctuality, and mutual respect, continually rewarding reliable and respectful community members.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- 8. FAQ SECTION ---------- */}
      <section id="faq" className="py-20 sm:py-24 bg-[var(--cream)] border-t border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[56ch] mx-auto text-center mb-12">
            <div className="text-[13px] font-bold uppercase tracking-widest text-[var(--coral-2)] mb-2.5">
              Clear Answers
            </div>
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] text-[16.5px]">
              Everything you need to know about intentional friendship matching on duogo.
            </p>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-[26px] p-6 sm:p-8 border border-[var(--line)] shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {/* Highlighted Question from User */}
              <AccordionItem value="item-0" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  How is duogo different from Bumble BFF or Meetup?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  duogo focuses on compatibility-first matching. Instead of endlessly browsing profiles or joining large groups, you get intentional introductions based on your personality, values, interests, and friendship preferences.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-1" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  Is duogo strictly platonic?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Yes, 100%. duogo is designed purely for friendship and social community. There is no dating matching, no romantic ambiguity, and zero tolerance for unsolicited advances or harassment. We are gender-blind and focused entirely on shared vibes and activities.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  How do match notifications work?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Notifications aren&apos;t restricted to once a week. Our compatibility engine pairs you anytime a high-compatibility match is found based on your lifestyle quiz, local area, and travel radius. You receive an instant alert and have 48 hours to review their compatibility radar, shared interests, and vibe tags, and decide whether to Connect or Pass.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  What happens if I pass on an introduction, or they pass on me?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Nothing happens, and neither party is ever notified. Because duogo is completely double-blind, unreciprocated passes expire quietly. You&apos;ll never experience rejection sting, and you&apos;ll receive a fresh introduction as soon as another compatible connection is discovered.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  How does Couples Mode work?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  In Couples Mode, you and your partner each complete the compatibility quiz and link your profiles with a quick invite code. Our engine pairs you 2-on-2 with another couple for four-person hangouts: dinner parties, board game trivia nights, double dates, and weekend getaways.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  Why are names and photos hidden at first?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Traditional social apps create bias based on headshots and follower counts. By looking at true compatibility dimensions first, such as energy levels, social battery, and conversational depth, you make authentic decisions. Once both people tap Connect, photos and full profiles unlock immediately.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  How does duogo guarantee introductions are actually close to me?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  During onboarding, you set your location using your postal code, GPS, or area name. You choose your preferred travel radius (from 5 km for neighborhood walks up to 50+ km for wider meetups) and our matching algorithm strictly honors your proximity bounds.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  Can I pause matching if I get busy?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Yes! You can pause matching with a single click from your dashboard or profile settings at any time. When you&apos;re ready for new friends, resume with one tap to begin receiving active match notifications again.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  What happens if I don&apos;t meet my match in 15 days?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  If you haven&apos;t met in person within 15 days, the connection will expire and the chat will be closed. Because our goal is real-life connection, we don&apos;t allow matches to linger in limbo. You will not be rematched with this person, which encourages both of you to take that first step. If life gets in the way, you can always message them to plan a meetup for the future before the 15 days are up!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10" className="border-none py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline text-left">
                  What counts as &ldquo;meeting in person&rdquo;?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Any real-world interaction! Grabbing a coffee, going for a walk, attending a local event together, or joining a small group hangout. Once you&apos;ve met, the connection stays active indefinitely.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ---------- 9. FINAL CTA SECTION ---------- */}
      <section className="text-center py-20 sm:py-24 bg-white border-t border-[var(--line)]" id="join">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-['Fraunces',serif] font-semibold text-[32px] sm:text-[42px] lg:text-[46px] text-[var(--ink)] tracking-[-0.02em] leading-tight">
              Your next great friendship could start today.
            </h2>
            <p className="text-[var(--ink-soft)] text-[16.5px] sm:text-[18px] max-w-lg mx-auto mt-4 leading-relaxed">
              Take the friendship quiz and get matched with someone who genuinely fits your personality and lifestyle.
            </p>

            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => handleStartSignup()}
                className="inline-flex items-center justify-center gap-2 px-[32px] py-[16px] rounded-full font-bold text-[16px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-md text-[var(--ink)]"
                style={{
                  background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                }}
              >
                <span>Take the Friendship Quiz</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 text-[13px] text-[var(--ink-soft)] font-medium">
              Free to take · 5 minutes · 100% Platonic &amp; Double-blind
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="py-14 sm:py-16 bg-[var(--cream)] border-t border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="flex justify-between items-center flex-wrap gap-5 mb-11">
            <div>
              <div className="font-['Fraunces',serif] text-[24px] font-bold text-[var(--ink)]">
                duogo<span className="text-[var(--coral-2)]">.</span>
              </div>
              <div className="text-[13.5px] text-[var(--ink-soft)] mt-1.5 font-medium">
                Intentional adult friendship · Matching by compatibility &amp; proximity
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white py-2 px-4 rounded-full text-[13.5px] font-semibold border border-[var(--line)]">
              🌐 English
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-[var(--line)] pt-10">
            <div>
              <h4 className="text-[12px] font-bold tracking-[0.05em] uppercase text-[var(--ink-soft)] mb-4">
                Modes
              </h4>
              <a
                href="#modes"
                onClick={() => setActiveTab("solo")}
                className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors"
              >
                Solo Explorer
              </a>
              <a
                href="#modes"
                onClick={() => setActiveTab("couples")}
                className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors"
              >
                Couples Mode
              </a>
              <a
                href="#radar"
                className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors"
              >
                Compatibility Radar
              </a>
            </div>

            <div>
              <h4 className="text-[12px] font-bold tracking-[0.05em] uppercase text-[var(--ink-soft)] mb-4">
                Community &amp; Safety
              </h4>
              <a href="#how" className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                How It Works
              </a>
              <a href="#safety" className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Safety Guidelines
              </a>
              <a href="#safety" className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Double-Blind Protocol
              </a>
              <a href="#faq" className="block text-[14.5px] mb-3 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                FAQ
              </a>
            </div>

            <div>
              <h4 className="text-[12px] font-bold tracking-[0.05em] uppercase text-[var(--ink-soft)] mb-4">
                Platform
              </h4>
              <a href="#about" className="block text-[14.5px] mb-2.5 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Find Your People
              </a>
              <a href="#radar" className="block text-[14.5px] mb-2.5 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Lifestyle Dimensions
              </a>
              <a href="#safety" className="block text-[14.5px] mb-2.5 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Privacy First
              </a>
              <span className="block text-[13px] text-[var(--ink-soft)] font-medium mt-1">
                Open to All 🌍
              </span>
            </div>

            <div>
              <h4 className="text-[12px] font-bold tracking-[0.05em] uppercase text-[var(--ink-soft)] mb-4">
                Follow along
              </h4>
              <div className="flex gap-2.5">
                <div className="w-9 h-9 rounded-full border border-[var(--line)] bg-white flex items-center justify-center text-[13px] font-semibold hover:border-[var(--coral-2)] cursor-pointer">
                  ◎
                </div>
                <div className="w-9 h-9 rounded-full border border-[var(--line)] bg-white flex items-center justify-center text-[13px] font-semibold hover:border-[var(--coral-2)] cursor-pointer">
                  ✕
                </div>
                <div className="w-9 h-9 rounded-full border border-[var(--line)] bg-white flex items-center justify-center text-[13px] font-semibold hover:border-[var(--coral-2)] cursor-pointer">
                  f
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between flex-wrap gap-3 border-t border-[var(--line)] mt-10 pt-6.5 text-[13px] text-[var(--ink-soft)]">
            <div className="flex gap-4.5 flex-wrap">
              <a href="#safety" className="hover:text-[var(--ink)] transition-colors">
                Privacy Policy
              </a>
              <a href="#safety" className="hover:text-[var(--ink)] transition-colors">
                Terms of Service
              </a>
            </div>
            <div>© 2026 duogo Inc. All rights reserved.</div>
          </div>
        </div>
      </footer>

      {/* ---------- LOGIN MODAL ---------- */}
      <Dialog
        open={showLogin}
        onOpenChange={(open) => {
          setShowLogin(open);
          if (!open) {
            setLoginStep("email");
            setLoginCode("");
            setLoginError(null);
            if (typeof window !== "undefined" && window.location.search.includes("login=true")) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-[var(--cream)] border-[var(--line)] rounded-[28px] p-6 text-[var(--ink)]">
          <DialogHeader className="text-center space-y-2">
            <div className="font-['Fraunces',serif] text-2xl font-bold tracking-tight">
              {loginStep === "email" ? (
                <>Welcome back to duogo<span className="text-[var(--coral-2)]">.</span></>
              ) : (
                <>Enter 6-digit code<span className="text-[var(--coral-2)]">.</span></>
              )}
            </div>
            <DialogDescription className="text-xs text-[var(--ink-soft)]">
              {loginStep === "email" ? (
                "Sign in with your registered email address. We'll send you a 6-digit one-time verification code."
              ) : (
                `Enter the 6-digit code sent to ${email}`
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Session Banner if already active */}
          {session?.user && loginStep === "email" && (
            <div className="p-3.5 rounded-2xl bg-white border border-[var(--line)] text-xs text-[var(--ink)] space-y-2 my-1 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--ink-soft)]">Signed in as:</span>
                <span className="font-bold truncate max-w-[200px]">{session.user.email || "Active Member"}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    navigate(getLoggedInDestination());
                  }}
                  className="flex-1 py-1.5 px-3 rounded-full bg-[#FF5436] text-white font-bold text-xs hover:bg-[#e04427] transition-colors cursor-pointer text-center"
                >
                  {isProfileComplete || profile?.onboarding_completed || profile?.first_name ? "Go to Dashboard" : "Resume Setup"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    toast({ title: "Signed out", description: "You can now log in with a different email." });
                  }}
                  className="py-1.5 px-3 rounded-full border border-[var(--line)] font-semibold text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer text-center"
                >
                  Switch Account
                </button>
              </div>
            </div>
          )}

          {loginStep === "email" ? (
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              {loginError === "new_user" ? (
                <div className="p-3.5 rounded-2xl bg-[#fff6f4] border border-[#ffcfc4] text-xs text-[var(--ink)] flex items-center justify-between gap-2 shadow-xs">
                  <span className="font-medium text-[var(--ink)]">Are you new here?</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (email.trim()) {
                        updateSignupDraft({ email: email.trim() });
                      }
                      setShowLogin(false);
                      handleStartSignup();
                    }}
                    className="font-bold text-[#FF5436] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Sign up.</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : loginError ? (
                <div className="p-3.5 rounded-2xl bg-[#fff2ee] border border-[var(--coral-1)] text-xs text-[var(--ink)] space-y-1">
                  <p className="font-medium text-[#c0382b]">{loginError}</p>
                </div>
              ) : null}

              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">
                  Your Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  required
                  className="w-full h-11 px-4 rounded-full bg-white border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--coral-2)]"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full h-11 rounded-full font-bold text-sm text-[var(--ink)] flex items-center justify-center gap-2 cursor-pointer transition-opacity disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                }}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Send 6-Digit Code →</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-[var(--ink-soft)]">
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    handleStartSignup();
                  }}
                  className="font-bold text-[var(--ink)] hover:text-[var(--coral-2)] underline transition-colors cursor-pointer"
                >
                  Sign up here
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={loginCode}
                  onChange={(val) => {
                    setLoginCode(val);
                    if (val.length === 6) {
                      handleVerifyLoginCode(val);
                    }
                  }}
                  autoFocus
                >
                  <InputOTPGroup className="gap-1.5 sm:gap-2">
                    <InputOTPSlot
                      index={0}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                    <InputOTPSlot
                      index={1}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                    <InputOTPSlot
                      index={2}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-1.5 sm:gap-2">
                    <InputOTPSlot
                      index={3}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                    <InputOTPSlot
                      index={4}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                    <InputOTPSlot
                      index={5}
                      className="w-10 h-13 text-xl font-mono font-bold rounded-xl border border-[var(--line)] bg-white focus:border-[var(--coral-2)] focus:ring-2 focus:ring-[var(--coral-2)]/20"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <button
                type="button"
                onClick={() => handleVerifyLoginCode()}
                disabled={verifyingLogin || loginCode.length < 6}
                className="w-full h-11 rounded-full font-bold text-sm text-[var(--ink)] flex items-center justify-center gap-2 cursor-pointer transition-opacity disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                }}
              >
                {verifyingLogin ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Verify &amp; Sign In</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-[var(--ink-soft)] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep("email");
                    setLoginCode("");
                  }}
                  className="hover:text-[var(--ink)] underline font-semibold"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={() => handleLogin()}
                  disabled={loginCooldown > 0 || sending}
                  className="hover:text-[var(--ink)] font-semibold disabled:opacity-50"
                >
                  {loginCooldown > 0 ? `Resend code in ${loginCooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- EMAIL SENT MODAL ---------- */}
      <Dialog open={showEmailSent} onOpenChange={setShowEmailSent}>
        <DialogContent className="sm:max-w-sm bg-[var(--cream)] border-[var(--line)] rounded-[28px] p-6 text-center text-[var(--ink)]">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--mint-1)] text-[var(--mint-2)] flex items-center justify-center mb-3">
            <Check className="h-6 w-6" />
          </div>
          <DialogHeader className="space-y-1 text-center">
            <DialogTitle className="font-['Fraunces',serif] text-xl font-bold">
              Check your inbox
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--ink-soft)]">
              We sent a sign-in link to your email. Click the link to access your duogo account.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-3">
            <button
              onClick={() => setShowEmailSent(false)}
              className="w-full h-10 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

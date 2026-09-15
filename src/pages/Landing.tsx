import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  HeartHandshake,
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
  const { session, profile, isProfileComplete, signOut } = useAuth();
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

  const getLoggedInDestination = () => {
    if (!isProfileComplete) {
      if (!profile?.user_type) return "/onboarding/user-type";
      if (!profile?.first_name) {
        return profile?.user_type === "couple" ? "/onboarding/couple-setup" : "/onboarding/profile";
      }
      if (!profile?.quiz_completed) return "/quiz";
      return "/onboarding/privacy-consent";
    }
    return "/dashboard";
  };

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
      if (
        msg.includes("signups not allowed") ||
        msg.includes("user not found") ||
        msg.includes("not found") ||
        msg.includes("signup")
      ) {
        const notFoundText =
          "No account found for this email. Please complete the sign-up flow and compatibility quiz to get started.";
        setLoginError(notFoundText);
        toast({
          title: "Account Not Found",
          description: notFoundText,
          variant: "destructive",
        });
      } else {
        setLoginError(error.message);
        toast({ title: "Error sending code", description: error.message, variant: "destructive" });
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

      // Verify that the user has completed onboarding and the quiz
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, user_type, quiz_completed, onboarding_completed")
        .eq("id", data.session.user.id)
        .maybeSingle();

      const isComplete = Boolean(
        p &&
        p.onboarding_completed &&
        p.quiz_completed &&
        p.first_name &&
        p.first_name.trim().length > 0 &&
        (p.user_type === "solo" || p.user_type === "couple")
      );

      if (!isComplete) {
        toast({
          title: "Finish setting up your profile ✦",
          description: "Complete your onboarding steps and quiz to start matching.",
        });
        if (!p?.user_type) {
          navigate("/onboarding/user-type", { replace: true });
        } else if (!p?.first_name) {
          navigate(p.user_type === "couple" ? "/onboarding/couple-setup" : "/onboarding/profile", { replace: true });
        } else if (!p?.quiz_completed) {
          navigate("/quiz", { replace: true });
        } else {
          navigate("/onboarding/privacy-consent", { replace: true });
        }
      } else {
        toast({
          title: "Welcome back! ✦",
          description: "Signed in successfully.",
        });
        navigate("/dashboard", { replace: true });
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
            <a href="#how" className="hover:text-[var(--coral-2)] transition-colors">
              How it works
            </a>
            <a href="#modes" className="hover:text-[var(--coral-2)] transition-colors">
              Solo &amp; couples
            </a>
            <a href="#radar" className="hover:text-[var(--coral-2)] transition-colors">
              Lifestyle radar
            </a>
            <a href="#safety" className="hover:text-[var(--coral-2)] transition-colors">
              Safety
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

      {/* ---------- HERO TOP BANNER ---------- */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-8 pt-6">
        <div
          className="rounded-[36px] relative overflow-hidden min-h-[440px] sm:min-h-[460px] lg:min-h-[480px] p-7 sm:p-10 lg:p-12 flex flex-col justify-between border border-[var(--line)] shadow-xl text-white bg-[#1A1A1A]"
        >
          {/* Background lifestyle image with real human faces */}
          <div className="absolute inset-0 z-0">
            <img
              src={cafeLifestyleImg}
              alt="Diverse adult friends laughing and talking together at a sunlit outdoor cafe"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[center_30%] scale-105 filter brightness-[0.96]"
            />
            {/* Dual gradient overlay: ensures high contrast for copy while revealing vivid smiling faces */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(90deg, rgba(20,18,16,0.94) 0%, rgba(20,18,16,0.85) 45%, rgba(20,18,16,0.30) 80%, rgba(20,18,16,0.15) 100%),
                  linear-gradient(0deg, rgba(20,18,16,0.92) 0%, rgba(20,18,16,0.40) 50%, transparent 80%)
                `,
              }}
            />
          </div>

          {/* Top meta indicator */}
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[12px] font-semibold tracking-wide uppercase text-white/95 border border-white/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--coral-2)] animate-pulse" />
              Real-Time Match Alerts · Intentional Connections
            </div>
          </div>

          {/* Banner bottom punch & floating match pill */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-end pt-12">
            <div className="max-w-xl">
              <div className="text-[12.5px] font-semibold text-[var(--coral-1)] mb-2">
                <span>Platonic Friendship · Gender-Blind · Solo &amp; Couples</span>
              </div>
              <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[38px] lg:text-[42px] text-white font-semibold leading-[1.15]">
                Real adult friends near you.{" "}
                <span className="italic font-medium text-[var(--coral-1)]">One match at a time.</span>
              </h2>
              <p className="text-white/85 text-[15px] sm:text-[16.5px] mt-2.5 leading-relaxed max-w-[50ch]">
                Connect over third-wave coffee, trail hikes, live indie gigs, and board games. No endless scrolling casino. No romantic ambiguity.
              </p>

              <div className="mt-6 flex items-center gap-3.5 flex-wrap">
                <button
                  onClick={() => handleStartSignup()}
                  className="inline-flex items-center justify-center gap-2 px-[26px] py-[13px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-lg text-[var(--ink)]"
                  style={{
                    background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                  }}
                >
                  <span>
                    {session
                      ? isProfileComplete
                        ? "Go to Dashboard"
                        : "Resume Setup"
                      : "Take the 5-min quiz"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <div className="text-[12.5px] font-medium text-white/70">
                  Curated by lifestyle, values &amp; proximity
                </div>
              </div>
            </div>

            {/* Right side floating real-life match highlights */}
            <div className="hidden lg:flex flex-col gap-3 items-end">
              <div className="bg-white/95 backdrop-blur-md text-[var(--ink)] p-3.5 rounded-[20px] shadow-2xl border border-white/40 max-w-[290px] transition-transform hover:-translate-y-1 duration-200">
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
                        New Match
                      </span>
                    </div>
                    <div className="font-['Fraunces',serif] font-semibold text-[14.5px] text-[var(--ink)]">
                      Maya &amp; Sam
                    </div>
                    <div className="text-[12px] text-[var(--ink-soft)]">
                      Bruce Trail hike &amp; pour-over coffee
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11.5px] font-bold">
                  <span className="text-[var(--coral-2)]">92% Lifestyle Match</span>
                  <span className="bg-[var(--mint-1)] text-[#123022] px-2 py-0.5 rounded-full">Connected</span>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md text-[var(--ink)] py-2 px-3.5 rounded-full shadow-lg border border-white/30 text-[12.5px] font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--mint-2)] animate-pulse" />
                <span>Active matching: <strong>Instant alert when matched</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- HEADLINE SECTION ---------- */}
      <section className="pt-14 pb-20 sm:pb-24">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 sm:gap-14 items-center">
            {/* Headline Copy */}
            <div>
              <h1 className="font-['Fraunces',serif] font-semibold text-[42px] sm:text-[54px] lg:text-[62px] leading-[1.06] text-[var(--ink)] tracking-[-0.02em]">
                Find Your{" "}
                <span className="block italic font-medium text-[var(--coral-2)]">People.</span>
              </h1>

              <p className="mt-5 text-[18px] sm:text-[20px] text-[var(--ink-soft)] leading-relaxed font-normal max-w-[48ch]">
                Making friends as an adult is broken.{" "}
                <span className="text-[var(--ink)] font-semibold">We fix that.</span> One real match at a time.
              </p>

              <div className="mt-8 flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => handleStartSignup()}
                  className="inline-flex items-center justify-center gap-2 px-[28px] py-[14px] rounded-full font-bold text-[15.5px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                    color: "var(--ink)",
                  }}
                >
                  Find your matches
                </button>
                <a
                  href="#how"
                  className="inline-flex items-center gap-1.5 font-semibold text-[14.5px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors py-2 px-3"
                >
                  See how it works
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Two pillars requested by user */}
              <div className="mt-10 pt-7 border-t border-[var(--line)] grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[var(--ink)]">
                    One match at a time.{" "}
                    <span className="text-[var(--ink-soft)] font-normal block sm:inline">Not a thousand profiles.</span>
                  </h3>
                  <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
                    No endless scrolling, no decision fatigue. We notify you whenever a highly compatible match is found so you can actually invest in a real connection.
                  </p>
                </div>
                <div>
                  <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[var(--ink)]">
                    Platonic only.{" "}
                    <span className="text-[var(--ink-soft)] font-normal block sm:inline">Zero ambiguity.</span>
                  </h3>
                  <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
                    We&apos;re gender-blind and strictly platonic. No romantic tension, no mixed signals. Romantic solicitations are prohibited. Just friendship, the way it should be.
                  </p>
                </div>
              </div>
            </div>

            {/* Phone Mockup with flanking lifestyle photo cards */}
            <div aria-hidden="true" className="w-full relative">
              {/* Floating Lifestyle Card 1: Outdoor park walk */}
              <div className="hidden sm:flex items-center gap-2.5 absolute -top-6 -right-4 lg:-right-6 bg-white p-2.5 pr-3.5 rounded-2xl shadow-[0_16px_36px_rgba(26,26,26,0.12)] border border-[var(--line)] rotate-[3deg] hover:rotate-0 transition-transform duration-300 z-20">
                <img
                  src={parkWalkImg}
                  alt="Friends walking in a park"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--mint-2)] inline-block" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Bruce Trail
                    </span>
                  </div>
                  <div className="text-[12.5px] font-bold text-[var(--ink)]">Maya &amp; Sam</div>
                  <div className="text-[11px] text-[var(--coral-2)] font-semibold">92% compatibility</div>
                </div>
              </div>

              {/* Floating Lifestyle Card 2: Evening dinner & conversation */}
              <div className="hidden sm:flex items-center gap-2.5 absolute -bottom-6 -left-4 lg:-left-6 bg-white p-2.5 pr-3.5 rounded-2xl shadow-[0_16px_36px_rgba(26,26,26,0.12)] border border-[var(--line)] -rotate-[2.5deg] hover:rotate-0 transition-transform duration-300 z-20">
                <img
                  src={dinnerChatImg}
                  alt="Friends laughing around a dinner table"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral-2)] inline-block" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Dundas West
                    </span>
                  </div>
                  <div className="text-[12.5px] font-bold text-[var(--ink)]">Game Night Hangout</div>
                  <div className="text-[11px] text-[var(--ink-soft)] font-medium">Matched 2 weeks ago</div>
                </div>
              </div>

              {/* Phone Device Frame */}
              <div className="bg-white rounded-[34px] p-3.5 pb-5 shadow-[0_24px_50px_rgba(26,26,26,0.14)] max-w-[320px] mx-auto border border-[var(--line)] relative z-10">
                {/* Phone Status */}
                <div className="flex justify-between text-[12px] font-bold px-2.5 pt-1.5 pb-3.5 text-[var(--ink-soft)]">
                  <span>Match Alert</span>
                  <span>5G ▮▮▮</span>
                </div>

                {/* Card 1: Grey */}
                <div className="rounded-[18px] p-4 mb-2.5 bg-[var(--cream-dim)]">
                  <div className="text-[11px] font-bold tracking-[0.04em] uppercase text-[var(--ink-soft)]">
                    New match alert
                  </div>
                  <h3 className="font-['Fraunces',serif] font-semibold text-[19px] mt-1.5 text-[var(--ink)]">
                    Someone new nearby (5 km)
                  </h3>
                  <div className="text-[12.5px] text-[var(--ink-soft)] mt-1.5 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral-2)] inline-block" />
                    88% lifestyle compatibility
                  </div>
                </div>

                {/* Card 2: Mint */}
                <div
                  className="rounded-[18px] p-4 mb-2.5"
                  style={{
                    background: "linear-gradient(135deg, var(--mint-1), var(--mint-2))",
                  }}
                >
                  <div className="flex justify-between items-center text-[var(--ink)]">
                    <strong className="text-[14.5px]">Why you matched</strong>
                    <span className="text-[14px]">✦</span>
                  </div>
                  <p className="text-[13.5px] mt-2 text-[var(--ink)] leading-snug">
                    You both chose unhurried pour-overs, scenic weekend trail hikes, and dry conversational humor.
                  </p>
                  <div className="mt-2.5 flex gap-1.5 flex-wrap">
                    <span className="text-[11.5px] font-bold bg-white/60 px-2.5 py-1 rounded-full text-[var(--ink)]">
                      Trail hiking
                    </span>
                    <span className="text-[11.5px] font-bold bg-white/60 px-2.5 py-1 rounded-full text-[var(--ink)]">
                      Specialty coffee
                    </span>
                    <span className="text-[11.5px] font-bold bg-white/60 px-2.5 py-1 rounded-full text-[var(--ink)]">
                      Board games
                    </span>
                  </div>
                </div>

                {/* Card 3: White with Real Revealed Match Face */}
                <div className="rounded-[18px] p-4 bg-white border border-[var(--line)]">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold tracking-[0.04em] uppercase text-[var(--ink-soft)]">
                      Status
                    </div>
                    <span className="text-[11.5px] font-bold bg-[var(--mint-2)] text-[#12291f] px-2.5 py-0.5 rounded-full">
                      Mutual Connect
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 pt-1">
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
                      <h3 className="font-['Fraunces',serif] font-semibold text-[15px] text-[var(--ink)] leading-tight">
                        Maya, 29
                      </h3>
                      <p className="text-[12px] text-[var(--ink-soft)]">
                        Photos unlocked • In-app chat open
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 3-STEP RITUAL CARDS ---------- */}
      <section id="how" className="py-20 sm:py-24">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[58ch] mx-auto text-center mb-14">
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
              The 3-step duogo ritual
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] text-[16.5px]">
              No infinite catalogs. No ghost towns. Just intentional adult friendship built on rhythm and reciprocity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-sm">
              <div className="text-[12px] font-bold tracking-wider text-[var(--coral-2)] uppercase">
                Step 01
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[var(--ink)] mt-1.5">
                Take the 5-min lifestyle quiz
              </h3>
              <p className="mt-2.5 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                10 thoughtful questions on how you actually spend your free hours, not another performative dating bio.
              </p>
              <div className="flex gap-2.5 my-4.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#FFE3D9]" title="Conversation Depth">
                  💬
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#DDF3E6]" title="Energy & Outdoor Pace">
                  🥾
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] bg-[#FFF1C9]" title="Social Battery & Budget">
                  ☕
                </div>
              </div>
              <p className="text-[var(--ink-soft)] text-[13.5px] leading-relaxed mt-auto">
                Calibrates social battery (introvert/extrovert), conversation depth, hangout budget, spontaneity vs. planning, and 20+ real weekend hobbies.
              </p>
            </div>

            {/* Card 2 */}
            <div
              className="rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-sm"
              style={{
                background: "linear-gradient(160deg, var(--mint-1), var(--mint-2))",
              }}
            >
              <div className="text-[12px] font-bold tracking-wider text-[#143024] uppercase">
                Step 02 · Real-Time Match Alerts
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[#143024] mt-1.5">
                Curated match notification
              </h3>
              <p className="mt-2.5 text-[#143024] text-[14.5px] leading-relaxed">
                One intentional match delivered straight to your dashboard. Double-blind by design: explore their 5-dimension radar, top shared vibe tags, local area, and travel radius. Photos and handles stay private until you both decide.
              </p>
              <div className="flex mt-auto pt-5">
                <div className="w-16 h-[78px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] p-1.5 overflow-hidden relative">
                  <img
                    src={parkWalkImg}
                    alt="Match photo blurred for double-blind privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
                <div className="w-16 h-[78px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] -ml-4 p-1.5 overflow-hidden relative">
                  <img
                    src={cafeLifestyleImg}
                    alt="Match photo blurred for double-blind privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
                <div className="w-16 h-[78px] bg-white/85 rounded-lg shadow-[0_6px_14px_rgba(20,48,36,0.18)] -ml-4 p-1.5 overflow-hidden relative">
                  <img
                    src={dinnerChatImg}
                    alt="Match photo blurred for double-blind privacy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded filter blur-[4px] scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Lock className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-[26px] p-7 sm:p-8 min-h-[320px] flex flex-col border border-[var(--line)] shadow-sm">
              <div className="text-[12px] font-bold tracking-wider text-[var(--coral-2)] uppercase">
                Step 03
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[21px] text-[var(--ink)] mt-1.5">
                Mutual reveal &amp; meet up
              </h3>
              <p className="mt-2.5 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                You have 48 hours to choose Connect or Pass. If you both tap Connect, photos and social links unlock and private in-app chat opens with conversational sparks. If either passes, it quietly expires with zero rejection sting.
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
                  <span className="text-[var(--mint-2)] font-black text-sm">✓</span> Photos unlocked
                </div>
              </div>
            </div>
          </div>

          {/* Center CTA */}
          <div className="text-center mt-12">
            <button
              onClick={() => handleStartSignup()}
              className="inline-flex items-center justify-center gap-2 px-[28px] py-[14px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                color: "var(--ink)",
              }}
            >
              Take the lifestyle quiz
            </button>
          </div>
        </div>
      </section>

      {/* ---------- MANIFESTO SECTION ---------- */}
      <section className="py-20 sm:py-24 bg-[var(--cream-dim)]/50 border-y border-[var(--line)]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[58ch] mx-auto text-center mb-14">
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
              This isn&apos;t a dating app wearing a friendship costume.
            </h2>
            <p className="mt-3.5 text-[var(--ink-soft)] text-[16.5px]">
              Dating apps thrive on keeping you swiping. duogo is engineered to get you off the screen and hanging out with real people.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                01
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                Platonic only. Zero ambiguity.
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                We&apos;re gender-blind and strictly platonic. No romantic tension, no mixed signals. Dating solicitations and harassment result in immediate removal.
              </p>
            </div>

            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                02
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                One match at a time. Not a thousand profiles.
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                No endless scrolling, no decision fatigue. We deliver curated matches directly to your notifications as soon as they are found so you can actually invest in a real connection.
              </p>
            </div>

            <div className="bg-white rounded-[22px] p-7 border border-[var(--line)] shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[var(--cream)] flex items-center justify-center text-[var(--coral-2)] font-bold mb-4">
                03
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--ink)]">
                Zero rejection sting.
              </h3>
              <p className="mt-2 text-[var(--ink-soft)] text-[14.5px] leading-relaxed">
                Because all decisions are double-blind, unreciprocated passes are never announced. If it&apos;s not a mutual click, neither party ever knows who passed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- MODES (SOLO & COUPLES) ---------- */}
      <section id="modes" className="py-20 sm:py-24">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[56ch] mx-auto text-center mb-11">
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
              However you hang out
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] text-[16.5px]">
              Explore one-on-one as an individual, or bring your partner along to meet couple friends.
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

      {/* ---------- RADAR SECTION ---------- */}
      <section id="radar" className="py-20 sm:py-24">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-11 items-center">
            <div>
              <div className="max-w-[56ch]">
                <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
                  See exactly why you were matched
                </h2>
                <p className="mt-3.5 text-[var(--ink-soft)] text-[16.5px] leading-relaxed">
                  Every match comes with an interactive compatibility radar covering five fundamental lifestyle dimensions scored directly from your quiz answers so you understand how you click before names or photos unlock.
                </p>
              </div>
              <div className="flex gap-5 mt-5 text-[14px] font-bold">
                <span className="flex items-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 bg-[var(--coral-2)]" />
                  You
                </span>
                <span className="flex items-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 bg-[var(--mint-2)]" />
                  Your match
                </span>
              </div>
            </div>

            <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[0_14px_32px_rgba(26,26,26,0.07)] border border-[var(--line)] max-w-md mx-auto w-full">
              <svg
                viewBox="0 0 300 300"
                width="100%"
                height="auto"
                role="img"
                aria-label="Radar chart comparing five lifestyle dimensions between two matched users"
                className="overflow-visible"
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

      {/* ---------- PRIVACY & SAFETY SECTION ---------- */}
      <div id="safety" className="px-5 sm:px-8">
        <section
          className="rounded-[40px] py-16 sm:py-20 px-6 sm:px-12 max-w-[1130px] mx-auto text-[var(--cream)]"
          style={{ background: "var(--ink)" }}
        >
          <div className="max-w-[58ch] mx-auto text-center mb-12">
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--cream)] tracking-[-0.01em]">
              Privacy is the default, not a buried setting
            </h2>
            <p className="mt-3.5 text-[var(--cream)]/75 text-[16.5px]">
              duogo only works when people feel secure enough to answer the lifestyle quiz with complete honesty.
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
                  Strictly Platonic Code
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                duogo is 100% platonic and gender-blind. Romantic solicitations, predatory behavior, or harassment result in permanent removal. Built-in reporting and 1-tap blocking are accessible 24/7.
              </p>
            </div>
            <div className="bg-[var(--cream)]/6 rounded-[22px] p-6.5 border border-[var(--cream)]/10">
              <div className="flex items-center gap-2.5 mb-2.5 text-[var(--coral-1)]">
                <HeartHandshake className="h-5 w-5" />
                <h3 className="font-['Fraunces',serif] font-semibold text-[19px] text-[var(--cream)]">
                  Post-Hangout Pulse Checks
                </h3>
              </div>
              <p className="text-[var(--cream)]/75 text-[15px] leading-relaxed">
                After meeting up, members complete a brief in-app pulse feedback to verify safety, punctuality, and mutual vibe, continually rewarding reliable, respectful community members.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- FAQ SECTION ---------- */}
      <section id="faq" className="py-20 sm:py-24">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <div className="max-w-[56ch] mx-auto text-center mb-12">
            <h2 className="font-['Fraunces',serif] font-semibold text-[28px] sm:text-[36px] text-[var(--ink)] tracking-[-0.01em]">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-[var(--ink-soft)] text-[16.5px]">
              Everything you need to know about the duogo experience.
            </p>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-[26px] p-6 sm:p-8 border border-[var(--line)] shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  Is duogo strictly platonic?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Yes, 100%. duogo is designed purely for friendship and social community. There is no dating matching, no romantic ambiguity, and zero tolerance for unsolicited advances or harassment. We are gender-blind and focused entirely on shared vibes and activities.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  How do match notifications and drops work?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Notifications aren&apos;t restricted to once a week. Our compatibility engine pairs you anytime a high-compatibility match is found based on your lifestyle quiz, local area, and travel radius. You receive an instant alert and have 48 hours to review their compatibility radar, shared interests, and vibe tags, and decide whether to Connect or Pass.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  What happens if I pass on a match, or they pass on me?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Nothing happens, and neither party is ever notified. Because duogo is completely double-blind, unreciprocated passes expire quietly. You&apos;ll never experience rejection sting, and you&apos;ll receive a fresh match as soon as another compatible connection is discovered.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  How does Couples Mode work?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  In Couples Mode, you and your partner each complete the compatibility quiz and link your profiles with a quick invite code. Our engine pairs you 2-on-2 with another couple for four-person hangouts: dinner parties, board game trivia nights, double dates, and weekend getaways.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  Why are names and photos hidden at first?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Traditional social apps create bias based on headshots and follower counts. By looking at true compatibility dimensions first, such as energy levels, social battery, and conversational depth, you make authentic decisions. Once both people tap Connect, photos and full profiles unlock immediately.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  Who is duogo designed for?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  duogo is created for adults who value genuine, intentional friendships. Whether you recently moved, your friend group is evolving, or you simply want to meet someone who shares your pace and interests, duogo connects you 1-on-1 (or couple-to-couple) with compatible people nearby.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-b border-[var(--line)] py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  How does duogo guarantee matches are actually close to me?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  During onboarding, you set your location using your postal code, GPS, or area name. You choose your preferred travel radius (from 5 km for neighborhood walks up to 50+ km for wider meetups) and our matching algorithm strictly honors your proximity bounds.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-none py-2">
                <AccordionTrigger className="font-['Fraunces',serif] font-semibold text-[17.5px] text-[var(--ink)] hover:text-[var(--coral-2)] hover:no-underline">
                  Can I pause matching if I get busy or want to hang out with a match?
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-[var(--ink-soft)] leading-relaxed pt-1 pb-3">
                  Yes! You can pause matching with a single click from your dashboard or profile settings at any time. When you&apos;re ready for new friends, resume with one tap to begin receiving active match notifications again.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA BAND ---------- */}
      <section className="text-center pt-10 pb-20 sm:pb-24" id="join">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
          <h2 className="font-['Fraunces',serif] font-semibold text-[29px] sm:text-[38px] lg:text-[40px] text-[var(--ink)] max-w-[22ch] mx-auto tracking-[-0.01em] leading-tight">
            Your next great friend is{" "}
            <em className="italic font-medium text-[var(--coral-2)]">one match away.</em>
          </h2>
          <p className="text-[var(--ink-soft)] text-[15.5px] max-w-md mx-auto mt-3">
            Take the 5-minute quiz today to get notified as soon as a compatible friend is found.
          </p>

          <form onSubmit={handleWaitlistSubmit} className="mt-7.5 flex gap-2.5 justify-center flex-wrap">
            <input
              type="email"
              placeholder="you@email.com"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              aria-label="Email address"
              className="font-['Inter',sans-serif] text-[15px] py-3.5 px-5 rounded-full border border-[var(--line)] bg-white min-w-[270px] font-medium text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--ink)] focus-visible:outline-offset-2"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-[26px] py-[13px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90 shadow-sm"
              style={{
                background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                color: "var(--ink)",
              }}
            >
              {waitlistSuccess ? "Added to waitlist ✓" : "Join the next drop"}
            </button>
          </form>
        </div>
      </section>

      {/* ---------- SECONDARY PHOTO BANNER ---------- */}
      <div className="max-w-[1180px] mx-auto px-6 sm:px-8 mb-12">
        <div
          className="rounded-[32px] relative overflow-hidden min-h-[200px] p-8 sm:p-10 flex flex-col justify-end"
          style={{
            background: `
              radial-gradient(circle at 15% 30%, rgba(255,183,158,0.55), transparent 55%),
              radial-gradient(circle at 80% 70%, rgba(119,203,166,0.35), transparent 50%),
              linear-gradient(135deg, #1A1A1A 0%, #2E2A26 55%, #3A2E28 100%)
            `,
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-['Fraunces',serif] text-2xl text-white font-semibold">
                Ready to find someone on your wavelength?
              </div>
              <div className="text-white/70 text-sm mt-1">
                Five minutes to complete your quiz. Double-blind and completely pressure-free.
              </div>
            </div>
            <button
              onClick={() => handleStartSignup()}
              className="inline-flex items-center justify-center gap-2 px-[26px] py-[13px] rounded-full font-bold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--coral-1), var(--coral-2))",
                color: "var(--ink)",
              }}
            >
              Get started now
            </button>
          </div>
        </div>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="py-14 sm:py-16">
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
              🌐 English ⌄
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
                Couples Companion
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
                How Matching Works
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
              <a href="#how" className="block text-[14.5px] mb-2.5 text-[var(--ink)] hover:text-[var(--coral-2)] transition-colors">
                Curated Drops
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

          {loginStep === "email" ? (
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              {loginError && (
                <div className="p-3.5 rounded-2xl bg-[#fff2ee] border border-[var(--coral-1)] text-xs text-[var(--ink)] space-y-2">
                  <p className="font-medium text-[#c0382b]">{loginError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogin(false);
                      handleStartSignup();
                    }}
                    className="text-xs font-bold text-[var(--ink)] underline hover:text-[var(--coral-2)] flex items-center gap-1 cursor-pointer"
                  >
                    Start Sign Up &amp; Take Quiz →
                  </button>
                </div>
              )}

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

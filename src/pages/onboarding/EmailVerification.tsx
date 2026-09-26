import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { toast } from "@/hooks/use-toast";
import { getSignupDraft, updateSignupDraft, syncSignupDraftToSupabase, clearSignupDraft } from "@/lib/signupState";
import { runAuthDiagnostic } from "@/lib/authDiagnostics";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Pencil,
  Loader2,
} from "lucide-react";

const EmailVerification = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const draft = getSignupDraft();
  const [email, setEmail] = useState(draft.email || "");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [resendCooldown, setResendCooldown] = useState(0);

  // If already logged in (e.g., opened magic link or existing session), sync and proceed
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && active) {
        await syncSignupDraftToSupabase(session.user);
        const updated = await refreshProfile();
        const draftData = getSignupDraft();
        if (updated?.onboarding_completed && updated?.quiz_completed) {
          clearSignupDraft();
          navigate("/dashboard", { replace: true });
        } else if (updated?.first_name || draftData.first_name) {
          navigate("/quiz", { replace: true });
        } else {
          navigate("/onboarding/user-type", { replace: true });
        }
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, refreshProfile]);

  const startResendTimer = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;

    if (!isSupabaseConfigured) {
      toast({
        title: "Authentication Not Configured",
        description: "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your deployment environment variables.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    updateSignupDraft({ email: email.trim() });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setSending(false);

      if (error) {
        let desc = error.message;
        if (desc.toLowerCase().includes("failed to fetch")) {
          desc = "Cannot reach authentication server. Please check your Supabase project status and ensure environment variables are configured in your hosting platform.";
        }
        toast({
          title: "Error sending verification code",
          description: desc,
          variant: "destructive",
        });
      } else {
        setStep("code");
        startResendTimer();
        toast({
          title: "Verification code sent! 📬",
          description: `Check ${email.trim()} for your 6-digit one-time code.`,
        });
      }
    } catch (err: unknown) {
      setSending(false);
      const message = err instanceof Error ? err.message : "Failed to connect to authentication service.";
      toast({
        title: "Connection error",
        description: message.toLowerCase().includes("fetch")
          ? "Unable to reach Supabase. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your deployment settings."
          : message,
        variant: "destructive",
      });
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const token = (codeToVerify || code).trim();
    if (!token || token.length < 6 || !email.trim()) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code sent to your email.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);

    // Verify OTP using type 'email' (Supabase default for signInWithOtp)
    let { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    // Fallback attempt with 'signup' if Supabase project configured as signup OTP
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

    if (error) {
      setVerifying(false);
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const verifiedUser = data.session?.user || data.user;
    if (verifiedUser) {
      toast({
        title: "Email verified! ✦",
        description: "Welcome to duogo. Unlocking your friendship matches...",
      });

      // Run diagnostic to evaluate auth user metadata vs profiles table
      try {
        await runAuthDiagnostic({ source: "email_verification_pre_sync", verbose: true });
      } catch (diagErr) {
        console.warn("[EmailVerification] Pre-sync diagnostic notice:", diagErr);
      }

      await syncSignupDraftToSupabase(verifiedUser);
      const updated = await refreshProfile(verifiedUser.id);

      // Run diagnostic post-sync to verify final profile state
      try {
        await runAuthDiagnostic({ source: "email_verification_post_sync" });
      } catch (diagErr) {
        console.warn("[EmailVerification] Post-sync diagnostic notice:", diagErr);
      }

      const draftData = getSignupDraft();
      if (updated?.onboarding_completed && updated?.quiz_completed) {
        clearSignupDraft();
        navigate("/dashboard", { replace: true });
      } else if (updated?.first_name || draftData.first_name) {
        navigate("/quiz", { replace: true });
      } else {
        navigate("/onboarding/user-type", { replace: true });
      }
    } else {
      setVerifying(false);
      toast({
        title: "Session issue",
        description: "Could not create session. Please try resending the code.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background text-[#1A1816] flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        {/* Top back button */}
        {step === "email" ? (
          <button
            onClick={() => navigate("/onboarding/privacy-consent")}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Privacy Confirmation
          </button>
        ) : (
          <button
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Change email
          </button>
        )}

        {step === "email" ? (
          <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card overflow-hidden">
            <CardContent className="pt-8 pb-8 px-6 sm:px-8 space-y-6">
              <div className="text-center space-y-2">
                <span className="inline-block px-3 py-0.5 rounded-full bg-[#FFF0EB] border border-[#FFD9CE] text-[#FF5436] text-xs font-semibold mb-1">
                  Final Step
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1816]">
                  Save your profile
                </h1>
                <p className="text-sm text-[#706A62]">
                  Enter your email to receive a 6-digit one-time code and unlock your friendship matches.
                </p>
              </div>

              {/* Summary pills */}
              <div className="rounded-2xl bg-[#FAF7F2] p-4 flex flex-wrap gap-2 justify-center text-xs font-semibold text-[#4A4540] border border-[#EFE8DD]">
                {draft.location_city && (
                  <span className="bg-white px-3 py-1 rounded-full border border-[#EFE8DD] shadow-2xs">
                    📍 {draft.location_city}
                  </span>
                )}
                {draft.user_type && (
                  <span className="bg-white px-3 py-1 rounded-full border border-[#EFE8DD] shadow-2xs capitalize">
                    {draft.user_type === "couple" ? "👥 Couple" : "👤 Solo"}
                  </span>
                )}
                {draft.first_name && (
                  <span className="bg-white px-3 py-1 rounded-full border border-[#EFE8DD] shadow-2xs">
                    👋 {draft.first_name}
                  </span>
                )}
                <span className="bg-[#FFF0EB] text-[#FF5436] px-3 py-1 rounded-full border border-[#FFD9CE]">
                  ✓ Quiz completed
                </span>
                {draft.privacy_consented && (
                  <span className="bg-[#E8F8F1] text-[#248A63] px-3 py-1 rounded-full border border-[#BDEBD7]">
                    🛡️ Privacy confirmed
                  </span>
                )}
              </div>

              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email-input" className="text-xs font-bold uppercase tracking-wider text-[#706A62] block">
                    Email Address
                  </label>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-13 text-base rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 font-semibold focus-visible:ring-[#FF5436]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="w-full h-13 sm:h-14 rounded-2xl text-base font-bold bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] gap-2 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-5 w-5" />
                      Send 6-Digit Code →
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-1.5 text-xs text-[#706A62]">
                <ShieldCheck className="w-4 h-4 text-[#3EB489]" />
                <span>Instant passwordless sign-in. Zero passwords to remember.</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card text-center overflow-hidden">
            <CardContent className="pt-8 pb-8 px-6 sm:px-8 space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0EB] border border-[#FFD9CE] text-[#FF5436]">
                <KeyRound className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816]">
                  Enter verification code
                </h2>
                <p className="text-sm text-[#706A62]">
                  We sent a 6-digit one-time code to:
                </p>
                <div className="inline-flex items-center gap-2 bg-[#FAF7F2] py-1.5 px-3.5 rounded-full border border-[#EFE8DD]">
                  <span className="font-bold text-[#1A1816] text-sm">{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                    }}
                    className="text-[#FF5436] hover:text-[#E84326] text-xs font-semibold flex items-center gap-0.5 cursor-pointer ml-1"
                    title="Change email"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* 6-Digit OTP Input */}
              <div className="space-y-3 py-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#706A62] block">
                  6-Digit Verification Code
                </label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(val) => {
                      setCode(val);
                      if (val.length === 6) {
                        handleVerifyCode(val);
                      }
                    }}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-1.5 sm:gap-2">
                      <InputOTPSlot
                        index={0}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                      <InputOTPSlot
                        index={1}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                      <InputOTPSlot
                        index={2}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup className="gap-1.5 sm:gap-2">
                      <InputOTPSlot
                        index={3}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                      <InputOTPSlot
                        index={4}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                      <InputOTPSlot
                        index={5}
                        className="w-11 h-14 sm:w-13 sm:h-16 text-xl sm:text-2xl font-mono font-bold rounded-xl border border-[#EFE8DD] bg-[#FAF7F2]/70 focus:border-[#FF5436] focus:ring-2 focus:ring-[#FF5436]/20"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-[#706A62]">
                  Enter or paste your 6-digit code, or tap the confirmation link in your email.
                </p>
              </div>

              {/* Verify Button */}
              <Button
                type="button"
                onClick={() => handleVerifyCode()}
                disabled={verifying || code.length < 6}
                className="w-full h-13 sm:h-14 rounded-2xl text-base font-bold bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying code…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Verify Code &amp; See Matches →
                  </>
                )}
              </Button>

              {/* Resend & help */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendCode()}
                    disabled={resendCooldown > 0 || sending}
                    className="text-xs font-semibold text-[#706A62] hover:text-[#1A1816] h-9"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </Button>
                </div>

                <div className="rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] p-3.5 text-left text-xs text-[#706A62] space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#3EB489] shrink-0 mt-0.5" />
                    <span>Check your spam or junk folder if the code doesn&apos;t arrive in 1 minute.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#3EB489] shrink-0 mt-0.5" />
                    <span>You can also click the sign-in link inside the email if you prefer.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="w-full max-w-lg mx-auto pt-8 pb-4 text-center">
        <p className="text-xs text-[#8C847B]">
          &copy; {new Date().getFullYear()} duogo · 100% Platonic &amp; gender-blind friendships
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;

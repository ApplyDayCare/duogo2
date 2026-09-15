import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { storeReferralCode } from "@/lib/referralUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Loader2, KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const JoinReferral = () => {
  const navigate = useNavigate();
  const { referralCode } = useParams<{ referralCode: string }>();
  const { session, loading: authLoading } = useAuth();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");

  useEffect(() => {
    if (!referralCode) { setValidating(false); return; }
    (async () => {
      const { data } = await supabase.rpc("lookup_referral_code", { _code: referralCode });
      const result = data as unknown as { valid?: boolean } | null;
      if (result?.valid) {
        storeReferralCode(referralCode);
        setValid(true);
      }
      setValidating(false);
    })();
  }, [referralCode]);

  if (authLoading || validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;
  if (!valid) return <Navigate to="/" replace />;

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setStep("code");
      toast({
        title: "Code sent! 📬",
        description: `We sent a 6-digit verification code to ${email.trim()}.`,
      });
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const token = (codeToVerify || code).trim();
    if (!token || token.length < 6 || !email.trim()) {
      toast({ title: "Invalid code", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }
    setVerifying(true);
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
    setVerifying(false);
    if (error) {
      toast({ title: "Verification failed", description: error.message || "Invalid or expired code.", variant: "destructive" });
    } else if (data.session) {
      toast({ title: "Welcome to duogo! ✦", description: "Account verified." });
      navigate("/onboarding/user-type");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground font-serif">duogo</h1>
          <p className="text-lg text-muted-foreground">
            You&apos;ve been invited by a friend!
          </p>
        </div>

        <Card className="border-0 shadow-lg rounded-[28px] overflow-hidden">
          <CardContent className="pt-6 pb-6 px-6 space-y-5">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Join the intentional friendship community: real connections, one match at a time.
            </p>
            <ul className="text-left text-sm text-foreground space-y-2 mx-auto max-w-xs">
              <li>✓ Gender-blind matching</li>
              <li>✓ For solos and couples</li>
              <li>✓ One match at a time</li>
              <li>✓ Real friendships, not endless swiping</li>
            </ul>

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4 pt-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 text-base rounded-xl"
                  maxLength={255}
                />
                <Button
                  type="submit"
                  className="h-12 w-full text-base font-semibold rounded-full gap-2"
                  disabled={sending || !email.trim()}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Send 6-Digit Code →
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to <strong className="text-foreground">{email}</strong>
                </div>

                <div className="flex justify-center py-1">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(val) => {
                      setCode(val);
                      if (val.length === 6) {
                        handleVerifyOtp(val);
                      }
                    }}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-1.5">
                      <InputOTPSlot index={0} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                      <InputOTPSlot index={1} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                      <InputOTPSlot index={2} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup className="gap-1.5">
                      <InputOTPSlot index={3} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                      <InputOTPSlot index={4} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                      <InputOTPSlot index={5} className="w-10 h-12 text-lg font-mono font-bold rounded-lg border" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={verifying || code.length < 6}
                  className="h-12 w-full text-base font-semibold rounded-full gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Verify Code &amp; Continue →
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                    }}
                    className="hover:text-foreground underline flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCode()}
                    disabled={sending}
                    className="hover:text-foreground underline"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              By signing up, you agree to our Terms and Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JoinReferral;

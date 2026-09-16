import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import OnboardingProgress from "@/components/OnboardingProgress";
import AvatarUpload from "@/components/AvatarUpload";
import { ArrowLeft, Copy, Check, UserPlus, Link2 } from "lucide-react";
import { validateSocialUrl } from "@/lib/socialValidation";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";

const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const CoupleSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const draft = getSignupDraft();
  const [mode, setMode] = useState<"choose" | "create" | "join">(draft.couple_mode || "choose");

  // Create state
  const [createName, setCreateName] = useState(draft.first_name || "");
  const [createSocial, setCreateSocial] = useState(draft.social_link || "");
  const [createAvatarUrl, setCreateAvatarUrl] = useState<string | null>(draft.avatar_url || null);
  const [createdCode, setCreatedCode] = useState(draft.couple_code || "");
  const [copied, setCopied] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Join state
  const [joinCode, setJoinCode] = useState(draft.couple_code || "");
  const [joinName, setJoinName] = useState(draft.first_name || "");
  const [joinSocial, setJoinSocial] = useState(draft.social_link || "");
  const [joinAvatarUrl, setJoinAvatarUrl] = useState<string | null>(draft.avatar_url || null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [partnerName, setPartnerName] = useState(draft.partner_name || "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSocial.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    const socialErr = validateSocialUrl(createSocial);
    if (socialErr) {
      toast({ title: "Invalid URL", description: socialErr, variant: "destructive" });
      return;
    }

    setCreateLoading(true);
    const code = createdCode || generateInviteCode();

    updateSignupDraft({
      user_type: "couple",
      couple_mode: "create",
      couple_code: code,
      first_name: createName.trim(),
      social_link: createSocial.trim(),
      avatar_url: createAvatarUrl,
    });

    if (user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_name: createName.trim(), social_link: createSocial.trim(), avatar_url: createAvatarUrl })
        .eq("id", user.id);

      if (profileError) {
        setCreateLoading(false);
        toast({ title: "Error", description: profileError.message, variant: "destructive" });
        return;
      }

      const { error: coupleError } = await supabase
        .from("couples")
        .insert({ invite_code: code, partner_a_id: user.id });

      setCreateLoading(false);

      if (coupleError) {
        toast({ title: "Error", description: coupleError.message, variant: "destructive" });
        return;
      }
    } else {
      setCreateLoading(false);
    }

    setCreatedCode(code);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim() || !joinSocial.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    const socialErr = validateSocialUrl(joinSocial);
    if (socialErr) {
      toast({ title: "Invalid URL", description: socialErr, variant: "destructive" });
      return;
    }

    setJoinLoading(true);

    updateSignupDraft({
      user_type: "couple",
      couple_mode: "join",
      couple_code: joinCode.trim().toUpperCase(),
      first_name: joinName.trim(),
      social_link: joinSocial.trim(),
      avatar_url: joinAvatarUrl,
    });

    if (user) {
      // Verify invite code in DB
      const { data: couple, error: fetchError } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id")
        .eq("invite_code", joinCode.trim().toUpperCase())
        .maybeSingle();

      if (fetchError || !couple) {
        setJoinLoading(false);
        toast({ title: "Invalid code", description: "That invite code doesn't exist. Check with your partner.", variant: "destructive" });
        return;
      }

      if (couple.partner_b_id) {
        setJoinLoading(false);
        toast({ title: "Code already used", description: "This invite code has already been claimed.", variant: "destructive" });
        return;
      }

      if (couple.partner_a_id === user.id) {
        setJoinLoading(false);
        toast({ title: "Oops", description: "You can't join your own invite code.", variant: "destructive" });
        return;
      }

      // Save profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_name: joinName.trim(), social_link: joinSocial.trim(), avatar_url: joinAvatarUrl })
        .eq("id", user.id);

      if (profileError) {
        setJoinLoading(false);
        toast({ title: "Error", description: profileError.message, variant: "destructive" });
        return;
      }

      // Link couple
      const { error: coupleError } = await supabase
        .from("couples")
        .update({ partner_b_id: user.id, both_verified: true })
        .eq("id", couple.id);

      if (coupleError) {
        setJoinLoading(false);
        toast({ title: "Error", description: coupleError.message, variant: "destructive" });
        return;
      }

      // Get partner name
      const { data: partner } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", couple.partner_a_id)
        .maybeSingle();

      setJoinLoading(false);
      setPartnerName(partner?.first_name || "your partner");
    } else {
      setJoinLoading(false);
      setPartnerName("your partner");
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Success screen after creating code
  if (createdCode) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card text-center">
            <CardContent className="space-y-6 pt-8 pb-8 px-6 sm:px-8">
              <div className="space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground">
                  Share this code with your partner
                </h2>
                <p className="text-sm text-[#706A62] dark:text-muted-foreground">
                  They'll need it to link their account with yours
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 p-4 bg-[#FFF8F5] rounded-2xl border border-[#FFD9CE]">
                <span className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.25em] text-[#FF5436] pl-2">{createdCode}</span>
                <button onClick={copyCode} className="rounded-xl p-2.5 text-[#706A62] hover:bg-white hover:text-[#1A1816] transition-colors cursor-pointer">
                  {copied ? <Check className="h-5 w-5 text-[#FF5436]" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <Button className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer" onClick={() => navigate("/onboarding/location")}>
                Continue to Location →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success screen after joining
  if (partnerName) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card text-center">
            <CardContent className="space-y-6 pt-8 pb-8 px-6 sm:px-8">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-[#F0FDF4] border border-[#BBF7D0]">
                <Check className="h-8 w-8 text-[#16A34A]" />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground">
                  You're linked with {partnerName}!
                </h2>
                <p className="text-sm text-[#706A62] dark:text-muted-foreground">
                  Your couple account is ready for location setup
                </p>
              </div>
              <Button className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer" onClick={() => navigate("/onboarding/location")}>
                Continue to Location →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Choose mode
  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
          <button onClick={() => navigate("/onboarding/looking-for")} className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back to Preferences
          </button>
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <div className="space-y-1.5 text-center">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground">Couple Setup</h1>
            <p className="text-sm text-[#706A62] dark:text-muted-foreground">Link your accounts together</p>
          </div>
          <div className="grid gap-4">
            <Card className="cursor-pointer border-2 border-[#EFE8DD] hover:border-[#FF5436] hover:bg-[#FFF8F5] transition-all rounded-[2rem] shadow-soft" onClick={() => setMode("create")}>
              <CardContent className="flex items-center gap-5 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
                  <UserPlus className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1816]">I'm starting the account</h2>
                  <p className="text-xs sm:text-sm text-[#706A62]">Create an invite code for your partner</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer border-2 border-[#EFE8DD] hover:border-[#FF5436] hover:bg-[#FFF8F5] transition-all rounded-[2rem] shadow-soft" onClick={() => setMode("join")}>
              <CardContent className="flex items-center gap-5 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
                  <Link2 className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1816]">My partner sent me a code</h2>
                  <p className="text-xs sm:text-sm text-[#706A62]">Enter the code to link your accounts</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Create form
  if (mode === "create") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
          <button onClick={() => setMode("choose")} className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card">
            <CardHeader className="pt-8 pb-3 px-6 sm:px-8 text-center space-y-1.5">
              <CardTitle className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816]">Your Details</CardTitle>
              <CardDescription className="text-sm text-[#706A62]">We'll create an invite code for your partner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-6 sm:px-8 pb-8 pt-2">
              <form onSubmit={handleCreate} className="space-y-5">
                <AvatarUpload
                  userId={user?.id}
                  currentUrl={createAvatarUrl}
                  onUploaded={setCreateAvatarUrl}
                  onRemoved={() => setCreateAvatarUrl(null)}
                  fallbackInitials={createName ? createName[0].toUpperCase() : "?"}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="createName" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">First Name</Label>
                  <Input id="createName" placeholder="Your first name" value={createName} onChange={(e) => setCreateName(e.target.value)} required maxLength={50} className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createSocial" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">Instagram or LinkedIn Profile URL</Label>
                  <Input id="createSocial" placeholder="https://instagram.com/yourhandle" value={createSocial} onChange={(e) => setCreateSocial(e.target.value)} required maxLength={200} className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]" />
                  <p className="text-xs text-[#706A62]">🔒 Social media profile links remain hidden at all times until you accept the match and get connected. No account? Email <a href="mailto:hello@duogo.space" className="text-[#FF5436] hover:underline font-medium">hello@duogo.space</a>.</p>
                </div>
                <Button type="submit" className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Invite Code →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Join form
  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        <button onClick={() => setMode("choose")} className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <OnboardingProgress currentStep={6} totalSteps={7} />
        <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card">
          <CardHeader className="pt-8 pb-3 px-6 sm:px-8 text-center space-y-1.5">
            <CardTitle className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816]">Join Your Partner</CardTitle>
            <CardDescription className="text-sm text-[#706A62]">Enter the code they shared with you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8 pt-2">
            <form onSubmit={handleJoin} className="space-y-5">
              <AvatarUpload
                userId={user?.id}
                currentUrl={joinAvatarUrl}
                onUploaded={setJoinAvatarUrl}
                onRemoved={() => setJoinAvatarUrl(null)}
                fallbackInitials={joinName ? joinName[0].toUpperCase() : "?"}
              />
              <div className="space-y-1.5">
                <Label htmlFor="joinCode" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">Invite Code</Label>
                <Input id="joinCode" placeholder="ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} required maxLength={6} className="text-center text-xl font-mono tracking-widest h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 font-bold focus-visible:ring-[#FF5436]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="joinName" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">First Name</Label>
                <Input id="joinName" placeholder="Your first name" value={joinName} onChange={(e) => setJoinName(e.target.value)} required maxLength={50} className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinSocial" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">Instagram or LinkedIn Profile URL</Label>
                <Input id="joinSocial" placeholder="https://instagram.com/yourhandle" value={joinSocial} onChange={(e) => setJoinSocial(e.target.value)} required maxLength={200} className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]" />
                <p className="text-xs text-[#706A62]">🔒 Social media profile links remain hidden at all times until you accept the match and get connected. No account? Email <a href="mailto:hello@duogo.space" className="text-[#FF5436] hover:underline font-medium">hello@duogo.space</a>.</p>
              </div>
              <Button type="submit" className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer" disabled={joinLoading}>
                {joinLoading ? "Joining..." : "Join Partner →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoupleSetup;

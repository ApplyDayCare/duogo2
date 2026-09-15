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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <OnboardingProgress currentStep={2} totalSteps={4} />
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-card text-center">
            <CardContent className="space-y-6 pt-8 pb-8 px-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Share this code with your partner</h2>
                <p className="text-sm text-muted-foreground">They'll need it to link their account with yours</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{createdCode}</span>
                <button onClick={copyCode} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <Button className="h-12 w-full text-base font-semibold rounded-full shadow-sm" onClick={() => navigate("/onboarding/location")}>
                Continue to Location
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <OnboardingProgress currentStep={2} totalSteps={4} />
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-card text-center">
            <CardContent className="space-y-6 pt-8 pb-8 px-6">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">You're linked with {partnerName}!</h2>
                <p className="text-sm text-muted-foreground">Your couple account is ready for location setup</p>
              </div>
              <Button className="h-12 w-full text-base font-semibold rounded-full shadow-sm" onClick={() => navigate("/onboarding/location")}>
                Continue to Location
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <button onClick={() => navigate("/onboarding/looking-for")} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Preferences
          </button>
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-foreground">Couple Setup</h1>
            <p className="text-muted-foreground">Link your accounts together</p>
          </div>
          <div className="grid gap-4">
            <Card className="cursor-pointer border-2 border-transparent transition-all hover:border-primary hover:shadow-md" onClick={() => setMode("create")}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">I'm starting the account</h2>
                  <p className="text-sm text-muted-foreground">Create an invite code for your partner</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer border-2 border-transparent transition-all hover:border-primary hover:shadow-md" onClick={() => setMode("join")}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Link2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">My partner sent me a code</h2>
                  <p className="text-sm text-muted-foreground">Enter the code to link your accounts</p>
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <button onClick={() => setMode("choose")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <OnboardingProgress currentStep={6} totalSteps={7} />
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Your Details</CardTitle>
              <CardDescription>We'll create an invite code for your partner</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <AvatarUpload
                  userId={user?.id}
                  currentUrl={createAvatarUrl}
                  onUploaded={setCreateAvatarUrl}
                  onRemoved={() => setCreateAvatarUrl(null)}
                  fallbackInitials={createName ? createName[0].toUpperCase() : "?"}
                />
                <div className="space-y-2">
                  <Label htmlFor="createName">First Name</Label>
                  <Input id="createName" placeholder="Your first name" value={createName} onChange={(e) => setCreateName(e.target.value)} required maxLength={50} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createSocial">Instagram or LinkedIn Profile URL</Label>
                  <Input id="createSocial" placeholder="https://instagram.com/yourhandle" value={createSocial} onChange={(e) => setCreateSocial(e.target.value)} required maxLength={200} className="h-12 rounded-xl" />
                  <p className="text-xs text-muted-foreground">🔒 Social media profile links remain hidden at all times until you accept the match and get connected. No account? Email <a href="mailto:hello@duogo.space" className="text-primary hover:underline font-medium">hello@duogo.space</a>.</p>
                </div>
                <Button type="submit" className="h-12 w-full text-base font-semibold rounded-full shadow-sm" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Invite Code"}
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <button onClick={() => setMode("choose")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <OnboardingProgress currentStep={6} totalSteps={7} />
        <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="text-xl">Join Your Partner</CardTitle>
            <CardDescription>Enter the code they shared with you</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <AvatarUpload
                userId={user?.id}
                currentUrl={joinAvatarUrl}
                onUploaded={setJoinAvatarUrl}
                onRemoved={() => setJoinAvatarUrl(null)}
                fallbackInitials={joinName ? joinName[0].toUpperCase() : "?"}
              />
              <div className="space-y-2">
                <Label htmlFor="joinCode">Invite Code</Label>
                <Input id="joinCode" placeholder="ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} required maxLength={6} className="text-center text-lg font-mono tracking-widest h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinName">First Name</Label>
                <Input id="joinName" placeholder="Your first name" value={joinName} onChange={(e) => setJoinName(e.target.value)} required maxLength={50} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinSocial">Instagram or LinkedIn Profile URL</Label>
                <Input id="joinSocial" placeholder="https://instagram.com/yourhandle" value={joinSocial} onChange={(e) => setJoinSocial(e.target.value)} required maxLength={200} className="h-12 rounded-xl" />
                <p className="text-xs text-muted-foreground">🔒 Social media profile links remain hidden at all times until you accept the match and get connected. No account? Email <a href="mailto:hello@duogo.space" className="text-primary hover:underline font-medium">hello@duogo.space</a>.</p>
              </div>
              <Button type="submit" className="h-12 w-full text-base font-semibold rounded-full shadow-sm" disabled={joinLoading}>
                {joinLoading ? "Joining..." : "Join Partner"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoupleSetup;

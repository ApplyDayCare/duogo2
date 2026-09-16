import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import OnboardingProgress from "@/components/OnboardingProgress";
import AvatarUpload from "@/components/AvatarUpload";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { validateSocialUrl } from "@/lib/socialValidation";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";

const SoloProfile = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const draft = getSignupDraft();
  const [firstName, setFirstName] = useState(draft.first_name || profile?.first_name || "");
  const [socialLink, setSocialLink] = useState(draft.social_link || (profile as any)?.social_link || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(draft.avatar_url || profile?.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.first_name) setFirstName((prev) => prev || profile.first_name || "");
      if ((profile as any)?.social_link) setSocialLink((prev) => prev || (profile as any).social_link || "");
      if (profile.avatar_url) setAvatarUrl((prev) => prev || profile.avatar_url);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !socialLink.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    const validationError = validateSocialUrl(socialLink);
    if (validationError) {
      setSocialError(validationError);
      return;
    }

    updateSignupDraft({
      first_name: firstName.trim(),
      social_link: socialLink.trim(),
      avatar_url: avatarUrl,
    });

    if (user) {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          social_link: socialLink.trim(),
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);
      setLoading(false);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    navigate("/onboarding/location");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        <button
          onClick={() => navigate("/onboarding/looking-for")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Preferences
        </button>

        <OnboardingProgress currentStep={5} totalSteps={6} />

        <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card overflow-hidden">
          <CardHeader className="pt-8 pb-3 px-6 sm:px-8 text-center space-y-1.5">
            <CardTitle className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816]">
              Tell us about yourself
            </CardTitle>
            <p className="text-sm text-[#706A62]">
              Your photo and name make your profile feel authentic
            </p>
          </CardHeader>
          <CardContent className="space-y-5 px-6 sm:px-8 pb-8 pt-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex justify-center pb-2">
                <AvatarUpload
                  userId={user?.id}
                  currentUrl={avatarUrl}
                  onUploaded={(url) => {
                    setAvatarUrl(url);
                    updateSignupDraft({ avatar_url: url });
                  }}
                  onRemoved={() => {
                    setAvatarUrl(null);
                    updateSignupDraft({ avatar_url: null });
                  }}
                  fallbackInitials={firstName ? firstName[0].toUpperCase() : "?"}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="Your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={50}
                  className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social" className="text-xs font-bold uppercase tracking-wider text-[#706A62]">
                  Instagram or LinkedIn Profile URL
                </Label>
                <Input
                  id="social"
                  placeholder="https://instagram.com/yourhandle"
                  value={socialLink}
                  onChange={(e) => {
                    setSocialLink(e.target.value);
                    setSocialError(null);
                  }}
                  required
                  maxLength={200}
                  className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]"
                />
                {socialError && <p className="text-xs text-destructive font-bold">{socialError}</p>}
                
                {/* Security explainer badge */}
                <div className="rounded-2xl bg-[#FAF7F2] p-4 border border-[#EFE8DD] space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A1816]">
                    <ShieldCheck className="h-4 w-4 text-[#3EB489]" />
                    <span>100% Private Social Links</span>
                  </div>
                  <p className="text-xs text-[#706A62] leading-relaxed">
                    Social media profile links remain hidden at all times until you accept the match and get connected.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer"
                disabled={loading}
              >
                {loading ? "Saving..." : "Continue to Location →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SoloProfile;

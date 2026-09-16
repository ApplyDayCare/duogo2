import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Pause,
  Play,
  Trash2,
  Navigation,
  CheckCircle2,
  MapPin,
  Users,
  Copy,
  Check,
  Link2,
  Unlink,
  Share2,
  Clock,
  UserPlus,
  ShieldCheck,
  Sparkles,
  Lock,
  UserCheck,
  Sliders,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { validateSocialUrl } from "@/lib/socialValidation";
import AvatarUpload from "@/components/AvatarUpload";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { QuizResponseSummary } from "@/components/QuizResponseSummary";
import { getOfflineProfile } from "@/lib/queryPersister";
import {
  formatCanadianPostalCode,
  detectCityFromPostalCode,
  detectCityFromCoordinates,
  extractPostalCode,
  extractCityName,
} from "@/lib/postalCodeUtils";
import { cn } from "@/lib/utils";

const RADIUS_OPTIONS = [
  { value: "5", label: "My neighborhood only", desc: "Within ~5 km (High match priority)" },
  { value: "15", label: "Nearby neighborhoods", desc: "Up to 15 km" },
  { value: "30", label: "Within 30 minutes drive", desc: "Up to 30 km" },
  { value: "60", label: "Across the region", desc: "Up to 60 km" },
];

interface PartnerProfileData {
  id: string;
  firstName: string;
  socialLink: string | null;
  avatarUrl: string | null;
  quizCompleted: boolean;
  locationCity: string | null;
}

const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [detectingPostal, setDetectingPostal] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);
  const [radius, setRadius] = useState("5");
  const [paused, setPaused] = useState(false);
  const [userType, setUserType] = useState("solo");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Couple & Partner State
  const [coupleData, setCoupleData] = useState<{
    id: string;
    inviteCode: string;
    partnerAId: string;
    partnerBId: string | null;
  } | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfileData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [showJoinCodeBox, setShowJoinCodeBox] = useState(false);
  const [linkingPartner, setLinkingPartner] = useState(false);
  const [unlinkingPartner, setUnlinkingPartner] = useState(false);
  const [switchingAccountType, setSwitchingAccountType] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  const loadCoupleAndPartner = async (currentUserId: string, currentUserType: string) => {
    if (currentUserType !== "couple") {
      setCoupleData(null);
      setPartnerProfile(null);
      return;
    }

    try {
      let { data: couple } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id, invite_code")
        .or(`partner_a_id.eq.${currentUserId},partner_b_id.eq.${currentUserId}`)
        .maybeSingle();

      // If no couple record exists yet for this user, auto-create one
      if (!couple) {
        const newCode = generateInviteCode();
        const { data: created } = await supabase
          .from("couples")
          .insert({
            invite_code: newCode,
            partner_a_id: currentUserId,
          })
          .select("id, partner_a_id, partner_b_id, invite_code")
          .maybeSingle();

        if (created) {
          couple = created;
        }
      }

      if (couple) {
        setCoupleData({
          id: couple.id,
          inviteCode: couple.invite_code,
          partnerAId: couple.partner_a_id,
          partnerBId: couple.partner_b_id,
        });

        const partnerId = couple.partner_a_id === currentUserId ? couple.partner_b_id : couple.partner_a_id;
        if (partnerId) {
          const { data: pp } = await supabase
            .from("profiles")
            .select("id, first_name, social_link, avatar_url, quiz_completed, location_city")
            .eq("id", partnerId)
            .maybeSingle();

          if (pp) {
            setPartnerProfile({
              id: pp.id,
              firstName: pp.first_name || "Partner",
              socialLink: pp.social_link || null,
              avatarUrl: pp.avatar_url || null,
              quizCompleted: Boolean(pp.quiz_completed),
              locationCity: pp.location_city || null,
            });
          } else {
            setPartnerProfile(null);
          }
        } else {
          setPartnerProfile(null);
        }
      }
    } catch (err) {
      console.error("Error loading couple details:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let p: any = null;
        try {
          const { data } = await supabase
            .from("profiles")
            .select("first_name, social_link, location_city, travel_radius_km, matching_paused, user_type, avatar_url")
            .eq("id", user.id)
            .single();
          p = data;
        } catch (fetchErr) {
          console.warn("[Profile] Online fetch failed, checking offline cache:", fetchErr);
        }

        if (!p) {
          // Fall back to IndexedDB cached profile
          p = await getOfflineProfile(user.id);
        }

        if (p) {
          setFirstName(p.first_name || "");
          setSocialLink(p.social_link || "");
          setAvatarUrl(p.avatar_url || null);
          const parsedPostal = extractPostalCode(p.location_city) || "";
          const parsedCity = extractCityName(p.location_city) || "";
          setPostalCode(parsedPostal);
          setCity(parsedCity);
          if (parsedPostal) {
            detectCityFromPostalCode(parsedPostal).then((res) => {
              if (res) {
                setDetectedBadge(res.neighborhood ? `${res.city} · ${res.neighborhood}` : res.city);
              }
            });
          }
          setRadius(String(p.travel_radius_km ?? "5"));
          setPaused(p.matching_paused ?? false);
          const effectiveType = p.user_type || "solo";
          setUserType(effectiveType);

          await loadCoupleAndPartner(user.id, effectiveType);
        }
      } catch (err) {
        console.error("Profile initialization error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handlePostalChange = async (rawVal: string) => {
    const formatted = formatCanadianPostalCode(rawVal);
    setPostalCode(formatted);

    if (formatted.replace(/\s+/g, "").length >= 3) {
      setDetectingPostal(true);
      try {
        const result = await detectCityFromPostalCode(formatted);
        if (result) {
          setCity(result.city);
          setDetectedBadge(
            result.neighborhood
              ? `${result.city} · ${result.neighborhood}`
              : `${result.city}, ${result.province}`
          );
        } else {
          setDetectedBadge(null);
        }
      } catch (err) {
        console.debug("Postal detection error", err);
      } finally {
        setDetectingPostal(false);
      }
    } else {
      setDetectedBadge(null);
    }
  };

  const handleGpsDetect = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation unsupported",
        description: "Your browser does not support GPS location.",
        variant: "destructive",
      });
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await detectCityFromCoordinates(pos.coords.latitude, pos.coords.longitude);
          if (res) {
            setCity(res.city);
            if (res.postalCode) setPostalCode(res.postalCode);
            setDetectedBadge(res.neighborhood ? `${res.city} · ${res.neighborhood}` : res.city);
            toast({
              title: "Location detected!",
              description: `Set to ${res.city} based on your device location.`,
            });
          }
        } catch (err) {
          toast({
            title: "Location error",
            description: "Could not resolve city from coordinates.",
            variant: "destructive",
          });
        } finally {
          setDetectingGps(false);
        }
      },
      () => {
        setDetectingGps(false);
        toast({
          title: "Location access denied",
          description: "Please enter your postal code or area.",
        });
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (!firstName.trim() || !socialLink.trim() || (!postalCode.trim() && !city.trim()) || !radius) {
      toast({
        title: "All fields are required",
        description: "Please enter your first name, social profile, and location to save changes.",
        variant: "destructive",
      });
      return;
    }
    const validationError = validateSocialUrl(socialLink);
    if (validationError) {
      setSocialError(validationError);
      return;
    }
    setSaving(true);
    const cleanPostal = postalCode.trim().toUpperCase();
    const locationString =
      cleanPostal && city && city !== cleanPostal ? `${city} · ${cleanPostal}` : city || cleanPostal;

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        social_link: socialLink.trim() || "",
        location_city: locationString,
        travel_radius_km: parseInt(radius),
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved ✓", description: "Your profile details have been updated." });
    }
  };

  const togglePause = async () => {
    if (!user) return;
    const next = !paused;
    await supabase.from("profiles").update({ matching_paused: next }).eq("id", user.id);
    setPaused(next);
    toast({ title: next ? "Matching paused" : "Matching resumed ✓" });
  };

  const handleCopyCode = () => {
    if (!coupleData?.inviteCode) return;
    navigator.clipboard.writeText(coupleData.inviteCode);
    setCopiedCode(true);
    toast({ title: "Copied!", description: "Couple invite code copied to clipboard." });
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    if (!coupleData?.inviteCode) return;
    const link = `${window.location.origin}/join/${coupleData.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast({ title: "Link Copied!", description: "Share this link with your partner to join." });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShare = async () => {
    if (!coupleData?.inviteCode) return;
    const link = `${window.location.origin}/join/${coupleData.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on duogo!",
          text: `Hey! Link our couple profile on duogo with my invite code: ${coupleData.inviteCode}`,
          url: link,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleLinkWithCode = async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      toast({
        title: "Invalid code",
        description: "Please enter a valid 6-character invite code.",
        variant: "destructive",
      });
      return;
    }
    if (!user) return;

    setLinkingPartner(true);
    try {
      const { data: targetCouple, error: fetchErr } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id, invite_code")
        .eq("invite_code", cleanCode)
        .maybeSingle();

      if (fetchErr || !targetCouple) {
        toast({
          title: "Code not found",
          description: "We couldn't find a couple profile with that code. Please check with your partner.",
          variant: "destructive",
        });
        setLinkingPartner(false);
        return;
      }

      if (targetCouple.partner_a_id === user.id) {
        toast({
          title: "Your own code",
          description: "This is your own invite code. Share it with your partner instead!",
          variant: "destructive",
        });
        setLinkingPartner(false);
        return;
      }

      if (targetCouple.partner_b_id && targetCouple.partner_b_id !== user.id) {
        toast({
          title: "Code already used",
          description: "This couple profile is already linked to another partner.",
          variant: "destructive",
        });
        setLinkingPartner(false);
        return;
      }

      const { error: linkErr } = await supabase
        .from("couples")
        .update({ partner_b_id: user.id, both_verified: true })
        .eq("id", targetCouple.id);

      if (linkErr) {
        toast({ title: "Error linking", description: linkErr.message, variant: "destructive" });
        setLinkingPartner(false);
        return;
      }

      await supabase.from("profiles").update({ user_type: "couple" }).eq("id", user.id);
      setUserType("couple");

      toast({ title: "Partner Linked! 🎉", description: "Successfully linked to your partner." });
      setJoinCodeInput("");
      setShowJoinCodeBox(false);
      await loadCoupleAndPartner(user.id, "couple");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not link partner", variant: "destructive" });
    } finally {
      setLinkingPartner(false);
    }
  };

  const handleUnlinkPartner = async () => {
    if (!user || !coupleData) return;
    setUnlinkingPartner(true);
    try {
      await supabase
        .from("couples")
        .update({ partner_b_id: null, both_verified: false })
        .eq("id", coupleData.id);

      toast({ title: "Partner Unlinked", description: "You have unlinked from your partner." });
      await loadCoupleAndPartner(user.id, userType);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to unlink", variant: "destructive" });
    } finally {
      setUnlinkingPartner(false);
    }
  };

  const handleToggleAccountType = async (targetType: "solo" | "couple") => {
    if (!user) return;
    setSwitchingAccountType(true);
    try {
      const { error } = await supabase.from("profiles").update({ user_type: targetType }).eq("id", user.id);

      if (error) throw error;

      setUserType(targetType);
      toast({
        title: targetType === "couple" ? "Switched to Couple Account" : "Switched to Solo Account",
        description:
          targetType === "couple"
            ? "You can now invite your partner to complete your duo profile."
            : "You are now matching individually with solo friends.",
      });

      await loadCoupleAndPartner(user.id, targetType);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSwitchingAccountType(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (userType === "couple") {
      await supabase
        .from("couples")
        .update({ partner_b_id: null })
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`);
    }
    await supabase.from("pulse_feedback").delete().eq("user_id", user.id);
    await supabase.from("quiz_responses").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("referrals").delete().eq("referrer_id", user.id);
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF5436]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Top Profile Hero Card */}
      <div className="rounded-3xl border border-[#EFE8DD] bg-white shadow-card overflow-hidden">
        {/* Subtle decorative cover header */}
        <div className="h-24 sm:h-28 bg-gradient-to-r from-[#FFF0EB] via-[#FAF7F2] to-[#FFF5F1] border-b border-[#F5EDE3] relative" />

        <div className="px-5 sm:px-8 pb-6 sm:pb-7 -mt-12 sm:-mt-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            {/* User Identity Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <div className="relative shrink-0">
                {user && (
                  <AvatarUpload
                    userId={user.id}
                    currentUrl={avatarUrl}
                    onUploaded={setAvatarUrl}
                    onRemoved={() => setAvatarUrl(null)}
                    fallbackInitials={firstName ? firstName[0].toUpperCase() : "?"}
                    size="lg"
                  />
                )}
              </div>

              <div className="space-y-1.5 pb-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] tracking-tight">
                    {firstName || "Your Profile"}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF0EB] text-[#FF5436] border border-[#FFD9CE]">
                    <Users className="h-3 w-3" />
                    {userType === "couple" ? "Couple Duo" : "Solo Account"}
                  </span>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-[#706A62] flex-wrap">
                  {city && (
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-[#FF5436]" />
                      <span>{city}</span>
                      {postalCode && <span className="text-muted-foreground font-mono">({postalCode})</span>}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        paused ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                      )}
                    />
                    <span className={paused ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                      {paused ? "Matching Paused" : "Matching Active"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                className="rounded-full border-[#EFE8DD] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#5C5752] h-10 px-4"
              >
                {paused ? (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5 text-[#FF5436]" />
                    Resume Matching
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1.5 text-[#706A62]" />
                    Pause Matching
                  </>
                )}
              </Button>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white font-bold text-xs sm:text-sm h-10 px-5 shadow-[0_4px_14px_rgba(255,84,54,0.25)] transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5 stroke-[2.5]" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* LEFT COLUMN: Identity, Location, Account Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Basic Info & Social Verification */}
          <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-[#F5EDE3]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0EB] text-[#FF5436]">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#1A1816]">Basic Info & Socials</CardTitle>
                    <CardDescription className="text-[11px] text-muted-foreground">
                      Verified handles for confirmed matches
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-bold text-[#1A1816]">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  className="rounded-xl border-[#EFE8DD] bg-[#FAF7F2] focus-visible:bg-white text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Alex"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="social" className="text-xs font-bold text-[#1A1816]">
                    Instagram or LinkedIn URL
                  </Label>
                  <span className="text-[10.5px] font-semibold text-[#FF5436] flex items-center gap-0.5">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                </div>
                <Input
                  id="social"
                  className="rounded-xl border-[#EFE8DD] bg-[#FAF7F2] focus-visible:bg-white text-sm font-mono text-xs sm:text-sm"
                  placeholder="https://instagram.com/yourhandle"
                  value={socialLink}
                  onChange={(e) => {
                    setSocialLink(e.target.value);
                    setSocialError(null);
                  }}
                  maxLength={200}
                />
                {socialError && <p className="text-xs text-destructive font-medium">{socialError}</p>}

                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE8DD] space-y-1 text-[11px] text-[#706A62]">
                  <p className="flex items-center gap-1.5 font-medium text-[#1A1816]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#FF5436] shrink-0" />
                    <span>Protected Contact Exchange</span>
                  </p>
                  <p className="leading-relaxed">
                    Social links remain encrypted and hidden until both sides accept a mutual match.
                  </p>
                </div>
              </div>

              {/* Account Mode Switcher */}
              <div className="pt-2 border-t border-[#F5EDE3] space-y-2">
                <Label className="text-xs font-bold text-[#1A1816]">Account Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => userType !== "solo" && handleToggleAccountType("solo")}
                    disabled={switchingAccountType}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                      userType === "solo"
                        ? "border-[#FF5436] bg-[#FFF9F7] ring-1 ring-[#FF5436]/20 shadow-2xs"
                        : "border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A1816]">Solo Account</span>
                      {userType === "solo" && <CheckCircle2 className="h-3.5 w-3.5 text-[#FF5436]" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Match 1-on-1 with nearby friends</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => userType !== "couple" && handleToggleAccountType("couple")}
                    disabled={switchingAccountType}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                      userType === "couple"
                        ? "border-[#FF5436] bg-[#FFF9F7] ring-1 ring-[#FF5436]/20 shadow-2xs"
                        : "border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A1816]">Couple Duo</span>
                      {userType === "couple" && <CheckCircle2 className="h-3.5 w-3.5 text-[#FF5436]" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Match together as a pair with couples</p>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Location & Travel Radius */}
          <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-[#F5EDE3]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0EB] text-[#FF5436]">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#1A1816]">Location & Distance</CardTitle>
                    <CardDescription className="text-[11px] text-muted-foreground">
                      Set where you prefer to meet friends
                    </CardDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGpsDetect}
                  disabled={detectingGps}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5436] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {detectingGps ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Detecting...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-3 w-3" /> Detect GPS
                    </>
                  )}
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Postal code input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1A1816]">Postal Code or Area</Label>
                <div className="relative">
                  <Input
                    type="text"
                    maxLength={7}
                    placeholder="e.g. M5V 2T6 or postal code"
                    value={postalCode}
                    onChange={(e) => handlePostalChange(e.target.value)}
                    className="rounded-xl border-[#EFE8DD] bg-[#FAF7F2] font-semibold uppercase tracking-wider text-sm pr-9"
                  />
                  {detectingPostal && (
                    <div className="absolute right-3 top-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-[#FF5436]" />
                    </div>
                  )}
                </div>

                {detectedBadge && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#FFF0EB] border border-[#FFD9CE] text-[#FF5436] text-xs font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#FF5436] shrink-0" />
                    <span className="truncate">
                      <strong>Detected Area:</strong> {detectedBadge}
                    </span>
                  </div>
                )}
              </div>

              {/* Active Location Highlight Card */}
              {city ? (
                <div className="rounded-2xl bg-[#FFF9F7] border border-[#FFD9CE] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-bold text-[#FF5436]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#FF5436]" />
                      <span>Active Location</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#FF5436] bg-[#FFF0EB] px-2 py-0.5 rounded-full">
                      Radius matching on
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-serif font-bold text-[#1A1816]">{city}</h4>
                    {detectedBadge && detectedBadge.includes("·") && (
                      <p className="text-xs text-[#706A62] font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0 text-[#FF5436]" />
                        <span>{detectedBadge.split("·")[1]?.trim()}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] text-xs text-muted-foreground text-center">
                  Enter your postal code or area above to set your location
                </div>
              )}

              {/* Travel Radius Selection */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-bold text-[#1A1816]">Travel Radius</Label>
                <RadioGroup value={radius} onValueChange={setRadius} className="space-y-2">
                  {RADIUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all",
                        radius === opt.value
                          ? "border-[#FF5436] bg-[#FFF9F7] ring-1 ring-[#FF5436]/20 shadow-2xs"
                          : "border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]"
                      )}
                    >
                      <RadioGroupItem value={opt.value} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1A1816]">{opt.label}</p>
                        <p className="text-[11px] text-[#706A62] truncate">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: App & Account Danger Zone */}
          <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-[#F5EDE3]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#706A62]">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-[#1A1816]">App & Preferences</CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Device installation & data controls
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="rounded-2xl border border-[#FFE0D6] bg-gradient-to-br from-[#FFF9F6] to-white p-3.5 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436] font-bold text-sm">
                    📱
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1A1816]">Use duogo as a Mobile App</p>
                    <p className="text-[11px] text-[#706A62] leading-relaxed mt-0.5">
                      Install duogo directly onto your home screen. Your existing profile, matches, and chats stay instantly logged in.
                    </p>
                  </div>
                </div>
                <PWAInstallPrompt variant="button" className="w-full justify-center h-9 font-bold text-xs" />
              </div>

              <div className="pt-2 border-t border-[#F5EDE3] space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-xs font-bold text-destructive hover:bg-destructive/10 rounded-xl h-9 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif text-xl">Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your profile, match history, and quiz responses.
                        {userType === "couple" &&
                          " This will also unlink you from your partner. They can continue using their account."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold"
                      >
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Couple Hub & Quiz Response Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Couple & Partner Section (if userType === "couple") */}
          {userType === "couple" && (
            <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-[#F5EDE3]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0EB] text-[#FF5436]">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-[#1A1816]">Couple Duo Profile</CardTitle>
                      <CardDescription className="text-[11px] text-muted-foreground">
                        Matching as a pair with other couples
                      </CardDescription>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFF0EB] text-[#FF5436] border border-[#FFD9CE]">
                    Pair Matching
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {partnerProfile ? (
                  /* Partner is linked */
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD]">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border-2 border-white shadow-2xs">
                          {partnerProfile.avatarUrl && (
                            <AvatarImage src={partnerProfile.avatarUrl} alt={partnerProfile.firstName} />
                          )}
                          <AvatarFallback className="bg-[#FFEFEA] text-[#FF5436] font-bold text-sm">
                            {partnerProfile.firstName?.[0]?.toUpperCase() || "P"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1A1816] text-sm">{partnerProfile.firstName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#F0FDF4] text-[#166534] font-semibold border border-[#DCFCE7] flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3 text-[#16A34A]" /> Linked Partner
                            </span>
                          </div>
                          {partnerProfile.socialLink && (
                            <p className="text-[11px] text-muted-foreground">
                              Social:{" "}
                              <span className="font-medium text-foreground">
                                @
                                {partnerProfile.socialLink
                                  .replace(/^(https?:\/\/)?(www\.)?(instagram\.com|linkedin\.com\/in)\//, "")
                                  .replace(/\/$/, "")}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 font-semibold rounded-full h-8 px-2.5"
                          >
                            <Unlink className="h-3.5 w-3.5 mr-1" /> Unlink
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-serif text-xl">
                              Unlink from {partnerProfile.firstName}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This unlinks your profiles. You will no longer match as a couple duo until linked again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleUnlinkPartner}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold"
                            >
                              {unlinkingPartner && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                              Unlink
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-[#EFE8DD] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A] shrink-0" />
                        <span className="text-muted-foreground">Duo Active</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#EFE8DD] flex items-center gap-1.5">
                        {partnerProfile.quizCompleted ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A] shrink-0" />
                            <span className="text-muted-foreground">Partner Quiz Done</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                            <span className="text-amber-700 font-semibold">Quiz Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Waiting for partner to link */
                  <div className="space-y-3.5">
                    <div className="rounded-2xl bg-[#FFF8F5] border border-[#FFD9CE] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-[#FF5436] font-bold text-sm">
                        <Clock className="h-4 w-4" />
                        <span>Waiting for your partner to join</span>
                      </div>
                      <p className="text-xs text-[#706A62] leading-relaxed">
                        Share this invite code or link with your partner so they can connect with your profile and take
                        the compatibility quiz.
                      </p>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-xl bg-white border border-[#FFD9CE] px-3 py-2 font-mono text-base font-bold tracking-widest text-center text-[#1A1816]">
                          {coupleData?.inviteCode || "Loading..."}
                        </div>
                        <Button size="sm" className="rounded-xl px-4 font-bold h-10" onClick={handleCopyCode}>
                          {copiedCode ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copiedCode ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyLink}
                          className="flex-1 rounded-xl font-bold border-[#FFD9CE] bg-white hover:bg-[#FFF5F1] text-xs h-9"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5 text-[#FF5436]" />
                          {copiedLink ? "Link Copied!" : "Copy Direct Link"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShare}
                          className="flex-1 rounded-xl font-bold border-[#FFD9CE] bg-white hover:bg-[#FFF5F1] text-xs h-9"
                        >
                          <Share2 className="h-3.5 w-3.5 mr-1.5 text-[#FF5436]" />
                          Share
                        </Button>
                      </div>
                    </div>

                    {/* Join code entry */}
                    <div className="pt-2">
                      {!showJoinCodeBox ? (
                        <button
                          type="button"
                          onClick={() => setShowJoinCodeBox(true)}
                          className="text-xs font-semibold text-[#FF5436] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Have an invite code from your partner? Enter it here
                        </button>
                      ) : (
                        <div className="space-y-2 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD]">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-[#1A1816]">Enter Partner's Invite Code</Label>
                            <button
                              type="button"
                              onClick={() => setShowJoinCodeBox(false)}
                              className="text-[11px] text-muted-foreground hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="e.g. K9X2P4"
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                              maxLength={8}
                              className="font-mono text-sm uppercase tracking-wider rounded-xl border-[#EFE8DD] bg-white"
                            />
                            <Button
                              size="sm"
                              onClick={handleLinkWithCode}
                              disabled={linkingPartner || !joinCodeInput.trim()}
                              className="rounded-xl font-bold h-10 px-4"
                            >
                              {linkingPartner ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Lifestyle & Vibe Quiz Response Summary */}
          {user && <QuizResponseSummary userId={user.id} />}
        </div>
      </div>

      {/* Floating Save Button on Mobile */}
      <div className="sm:hidden sticky bottom-4 z-30 pt-2 pb-1">
        <Button
          className="w-full h-12 text-sm font-bold bg-[#FF5436] hover:bg-[#E84326] text-white rounded-full shadow-[0_6px_20px_rgba(255,84,54,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
          <span>{saving ? "Saving changes..." : "Save Profile Changes"}</span>
        </Button>
      </div>
    </div>
  );
};

export default Profile;

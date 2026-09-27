import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateReferralCode } from "@/lib/referralUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Copy, Instagram, Mail, ArrowLeft, Users, HeartHandshake } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Referral = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState({ signups: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Check for existing referral record
      const { data: existing } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .maybeSingle();

      if (existing) {
        setReferralCode(existing.referral_code);
        setStats({ signups: existing.successful_signups });
      } else {
        // Generate and save new referral code
        let code = generateReferralCode();
        let attempts = 0;
        while (attempts < 5) {
          const { error } = await supabase.from("referrals").insert({
            referrer_id: user.id,
            referral_code: code,
          });
          if (!error) {
            // Also store on profile
            await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
            break;
          }
          code = generateReferralCode();
          attempts++;
        }
        setReferralCode(code);
        setStats({ signups: 0 });
      }
      setLoading(false);
    })();
  }, [user]);

  const referralUrl = `${window.location.origin}/join/${referralCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralUrl);
    toast({ title: "Link copied! 📋" });
  };

  const shareEmail = () => {
    const subject = encodeURIComponent("Check out duogo");
    const body = encodeURIComponent(
      `Hey! I've been using duogo to meet people nearby. Here's an invite link to check it out: ${referralUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareInstagram = () => {
    const text = `Check out duogo: ${referralUrl}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Link copied to clipboard 📱" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white overflow-hidden">
          <div className="bg-gradient-to-br from-[#FFF0EB] via-[#FFF8F5] to-white p-6 pb-4 text-center border-b border-[#F5EDE3]">
            <span className="inline-block text-3xl mb-2">🌱</span>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Share duogo
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              Help others expand their social circle.
            </p>
          </div>

          <CardContent className="space-y-5 p-6">
            {/* Referral link */}
            <div className="rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2] p-4 space-y-2">
              <p className="text-xs font-bold text-foreground">Your Invite Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-white px-3.5 py-2.5 text-xs font-mono text-foreground border border-[#EFE8DD] shadow-2xs">
                  {referralUrl}
                </code>
                <Button size="icon" variant="outline" className="rounded-xl h-10 w-10 shrink-0 border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]" onClick={copyLink}>
                  <Copy className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>

            {/* Why share */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#EFE8DD] bg-[#FFF8F5] p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">In Your Area</p>
                <ul className="text-xs text-foreground space-y-1.5 font-medium">
                  <li className="flex items-center gap-1.5"><span className="text-primary font-bold">✓</span> Find your people</li>
                  <li className="flex items-center gap-1.5"><span className="text-primary font-bold">✓</span> Closer distances</li>
                  <li className="flex items-center gap-1.5"><span className="text-primary font-bold">✓</span> Real-life meetups</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-[#EFE8DD] bg-white p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">When They Join</p>
                <ul className="text-xs text-foreground space-y-1.5 font-medium">
                  <li className="flex items-center gap-1.5"><span className="text-emerald-600 font-bold">✓</span> Direct access</li>
                  <li className="flex items-center gap-1.5"><span className="text-emerald-600 font-bold">✓</span> Compatibility quiz</li>
                  <li className="flex items-center gap-1.5"><span className="text-emerald-600 font-bold">✓</span> 1-on-1 matches</li>
                </ul>
              </div>
            </div>

            {/* Community Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] p-3.5 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="font-serif text-2xl font-bold text-foreground">{stats.signups}</p>
                <p className="text-[11px] text-muted-foreground font-medium">People joined</p>
              </div>
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] p-3.5 text-center">
                <HeartHandshake className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="font-serif text-base font-bold text-foreground mt-1">
                  Active
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">Profile standing</p>
              </div>
            </div>

            {/* Share buttons */}
            <div className="space-y-2 pt-1">
              <Button className="w-full h-12 rounded-full font-bold shadow-soft" onClick={shareInstagram}>
                <Instagram className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-full font-bold border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]" onClick={shareEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Email Link
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-full font-bold border-[#EFE8DD] bg-white hover:bg-[#FAF7F2]" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full rounded-full font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/matches")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Matches
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Referral;

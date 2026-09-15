import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Baby, Heart, Check, Plus, Minus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OnboardingProgress from "@/components/OnboardingProgress";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface KidStageOption {
  id: string;
  label: string;
  ageRange: string;
  description: string;
  emoji: string;
}

const KID_STAGES: KidStageOption[] = [
  {
    id: "baby",
    label: "Baby",
    ageRange: "Under 1 year",
    description: "Infant under 12 months",
    emoji: "👶",
  },
  {
    id: "toddler",
    label: "Toddler",
    ageRange: "1-3 years",
    description: "1 to 3 years old",
    emoji: "🧸",
  },
  {
    id: "preschooler",
    label: "Preschooler",
    ageRange: "4-5 years",
    description: "4 to 5 years old",
    emoji: "🎨",
  },
  {
    id: "school_age",
    label: "School-age",
    ageRange: "6-12 years",
    description: "6 to 12 years old",
    emoji: "🎒",
  },
  {
    id: "teen",
    label: "Teenager",
    ageRange: "13-17 years",
    description: "13 to 17 years old",
    emoji: "🎧",
  },
  {
    id: "adult",
    label: "Adult child",
    ageRange: "18+ years",
    description: "18 years or older",
    emoji: "🎓",
  },
];

const Kids = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = getSignupDraft();

  // Initial state based on saved draft
  const [hasKids, setHasKids] = useState<boolean | null>(
    draft.has_kids !== undefined ? draft.has_kids : null
  );

  // Map of stageId -> count of kids in that stage
  const [stageCounts, setStageCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    if (draft.kids_stages && draft.kids_stages.length > 0) {
      draft.kids_stages.forEach((stage) => {
        counts[stage] = (counts[stage] || 0) + 1;
      });
    }
    return counts;
  });

  const [loading, setLoading] = useState(false);

  // Total kids calculated automatically from selections
  const totalKidsCount = Object.values(stageCounts).reduce((sum, c) => sum + c, 0);

  // Toggle or increment stage selection
  const toggleStage = (stageId: string) => {
    setStageCounts((prev) => {
      const current = prev[stageId] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[stageId];
        return next;
      } else {
        return { ...prev, [stageId]: 1 };
      }
    });
  };

  const incrementStage = (stageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStageCounts((prev) => ({
      ...prev,
      [stageId]: (prev[stageId] || 0) + 1,
    }));
  };

  const decrementStage = (stageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStageCounts((prev) => {
      const current = prev[stageId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[stageId];
        return next;
      }
      return {
        ...prev,
        [stageId]: current - 1,
      };
    });
  };

  const handleSelectNoKids = () => {
    setHasKids(false);
    setStageCounts({});
  };

  const handleSelectHasKids = () => {
    setHasKids(true);
  };

  const handleContinue = async () => {
    if (hasKids === null) return;
    if (hasKids && totalKidsCount === 0) return;

    // Generate selected stages array and friendly summary
    const selectedStagesList: string[] = [];
    const summaryParts: string[] = [];

    KID_STAGES.forEach((stage) => {
      const count = stageCounts[stage.id] || 0;
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          selectedStagesList.push(stage.id);
        }
        if (count === 1) {
          summaryParts.push(`${stage.label} (${stage.ageRange})`);
        } else {
          summaryParts.push(`${count}× ${stage.label} (${stage.ageRange})`);
        }
      }
    });

    const kidsSummary = hasKids
      ? summaryParts.join(", ")
      : "No kids";

    updateSignupDraft({
      has_kids: hasKids,
      kids_stages: hasKids ? selectedStagesList : [],
      kids_count: hasKids ? totalKidsCount : 0,
      kids_summary: kidsSummary,
    });

    if (user) {
      setLoading(true);
      try {
        await supabase
          .from("profiles")
          .update({ last_active: new Date().toISOString() })
          .eq("id", user.id);
      } catch (e) {
        console.warn("Profile update error:", e);
      } finally {
        setLoading(false);
      }
    }

    navigate("/onboarding/looking-for");
  };

  const canContinue = hasKids === false || (hasKids === true && totalKidsCount > 0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] dark:bg-background px-4 py-4 sm:py-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-5">
        <button
          onClick={() => navigate("/onboarding/gender")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Couple Role
        </button>

        <OnboardingProgress currentStep={4} totalSteps={7} />

        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground tracking-tight">
            Do you have kids?
          </h1>
          <p className="text-xs sm:text-sm text-[#706A62] dark:text-muted-foreground">
            We'll connect you with other couples at a matching family stage
          </p>
        </div>

        {/* Primary Choice: No Kids vs Yes */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            onClick={handleSelectNoKids}
            className={`cursor-pointer border-2 transition-all duration-200 rounded-2xl shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.98] ${
              hasKids === false
                ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7] dark:bg-card"
                : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
            }`}
          >
            <CardContent className="flex flex-col items-center text-center p-3.5 space-y-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#1A1816] dark:text-foreground">No Kids</h3>
                <p className="text-[11px] text-[#706A62] dark:text-muted-foreground mt-0.5">Couple only</p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={handleSelectHasKids}
            className={`cursor-pointer border-2 transition-all duration-200 rounded-2xl shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.98] ${
              hasKids === true
                ? "border-[#FF5436] ring-2 ring-[#FF5436]/20 bg-[#FFF9F7] dark:bg-card"
                : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
            }`}
          >
            <CardContent className="flex flex-col items-center text-center p-3.5 space-y-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#FF5436]">
                <Baby className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#1A1816] dark:text-foreground">Yes, We Have Kids</h3>
                <p className="text-[11px] text-[#706A62] dark:text-muted-foreground mt-0.5">Select ages below</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multi-Select Kids Ages (Expanded when Yes is chosen) */}
        {hasKids === true && (
          <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span>Select your children's age stages</span>
                <span className="text-xs font-normal text-muted-foreground">(Multiple allowed)</span>
              </label>
              {totalKidsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  <Users className="h-3 w-3" />
                  {totalKidsCount} {totalKidsCount === 1 ? "child" : "children"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {KID_STAGES.map((stage) => {
                const count = stageCounts[stage.id] || 0;
                const isSelected = count > 0;

                return (
                  <div
                    key={stage.id}
                    onClick={() => toggleStage(stage.id)}
                    role="button"
                    tabIndex={0}
                    className={`relative flex items-center justify-between p-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 select-none ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                        : "border-border/70 bg-white dark:bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0" role="img" aria-label={stage.label}>
                        {stage.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <span>{stage.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{stage.ageRange}</p>
                      </div>
                    </div>

                    {/* Checkbox indicator or Counter Controls */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isSelected ? (
                        <div className="flex items-center gap-1 bg-white dark:bg-card rounded-full border border-primary/30 p-0.5 shadow-2xs">
                          {count > 1 && (
                            <button
                              type="button"
                              onClick={(e) => decrementStage(stage.id, e)}
                              className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Decrease"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          )}
                          <span className="text-xs font-bold text-primary px-1.5">{count}</span>
                          <button
                            type="button"
                            onClick={(e) => incrementStage(stage.id, e)}
                            className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Add another in this stage"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Automatically calculated indicator summary */}
            {totalKidsCount > 0 ? (
              <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 p-3 text-xs text-foreground flex items-start gap-2">
                <span className="text-base leading-none">👶</span>
                <div>
                  <strong className="font-semibold">
                    Automatically counted: {totalKidsCount} {totalKidsCount === 1 ? "child" : "children"}
                  </strong>
                  <p className="text-muted-foreground mt-0.5">
                    {KID_STAGES.filter((s) => (stageCounts[s.id] || 0) > 0)
                      .map((s) => {
                        const cnt = stageCounts[s.id];
                        return cnt > 1 ? `${cnt}× ${s.label} (${s.ageRange})` : `${s.label} (${s.ageRange})`;
                      })
                      .join(" • ")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Tap one or more age stages above to indicate your kids.
              </p>
            )}
          </div>
        )}

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          disabled={!canContinue || loading}
          className="h-13 w-full text-base font-bold rounded-full bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? "Saving..." : "Continue →"}
        </Button>

        {/* Footer disclaimer */}
        <p className="text-center text-xs text-[#706A62]/90 dark:text-muted-foreground/80 pt-1">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-[#1A1816] dark:hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default Kids;

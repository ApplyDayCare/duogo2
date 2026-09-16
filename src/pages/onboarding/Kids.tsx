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
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        <button
          onClick={() => navigate("/onboarding/gender")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Couple Role
        </button>

        <OnboardingProgress currentStep={4} totalSteps={7} />

        <div className="space-y-1.5 text-center pt-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground tracking-tight">
            Do you have kids?
          </h1>
          <p className="text-sm text-[#706A62] dark:text-muted-foreground">
            We'll connect you with other couples at a matching family stage
          </p>
        </div>

        {/* Primary Choice: No Kids vs Yes */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
          <Card
            onClick={handleSelectNoKids}
            className={`cursor-pointer border-2 transition-all duration-200 rounded-3xl shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.98] ${
              hasKids === false
                ? "border-[#FF5436] ring-4 ring-[#FF5436]/15 bg-[#FFF9F7] dark:bg-card"
                : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
            }`}
          >
            <CardContent className="flex flex-col items-center text-center p-5 sm:p-6 space-y-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shadow-2xs">
                <Heart className="h-7 w-7" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1A1816] dark:text-foreground">No Kids</h3>
                <p className="text-xs text-[#706A62] dark:text-muted-foreground">Couple only</p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={handleSelectHasKids}
            className={`cursor-pointer border-2 transition-all duration-200 rounded-3xl shadow-soft hover:shadow-card hover:-translate-y-0.5 active:scale-[0.98] ${
              hasKids === true
                ? "border-[#FF5436] ring-4 ring-[#FF5436]/15 bg-[#FFF9F7] dark:bg-card"
                : "border-[#EFE8DD] hover:border-[#DECBBF] bg-white dark:bg-card"
            }`}
          >
            <CardContent className="flex flex-col items-center text-center p-5 sm:p-6 space-y-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436] shadow-2xs">
                <Baby className="h-7 w-7" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1A1816] dark:text-foreground">Yes, We Have Kids</h3>
                <p className="text-xs text-[#706A62] dark:text-muted-foreground">Select ages below</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multi-Select Kids Ages (Expanded when Yes is chosen) */}
        {hasKids === true && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span>Select your children's age stages</span>
                <span className="text-xs font-normal text-muted-foreground">(Multiple allowed)</span>
              </label>
              {totalKidsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  <Users className="h-3.5 w-3.5" />
                  {totalKidsCount} {totalKidsCount === 1 ? "child" : "children"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KID_STAGES.map((stage) => {
                const count = stageCounts[stage.id] || 0;
                const isSelected = count > 0;

                return (
                  <div
                    key={stage.id}
                    onClick={() => toggleStage(stage.id)}
                    role="button"
                    tabIndex={0}
                    className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all duration-150 select-none ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10 shadow-xs"
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
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isSelected ? (
                        <div className="flex items-center gap-1.5 bg-white dark:bg-card rounded-full border border-primary/30 p-1 shadow-2xs">
                          {count > 1 && (
                            <button
                              type="button"
                              onClick={(e) => decrementStage(stage.id, e)}
                              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                              title="Decrease"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="text-xs font-bold text-primary px-1.5">{count}</span>
                          <button
                            type="button"
                            onClick={(e) => incrementStage(stage.id, e)}
                            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                            title="Add another in this stage"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Automatically calculated indicator summary */}
            {totalKidsCount > 0 ? (
              <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 p-3.5 text-xs sm:text-sm text-foreground flex items-start gap-2.5">
                <span className="text-lg leading-none">👶</span>
                <div>
                  <strong className="font-semibold">
                    Automatically counted: {totalKidsCount} {totalKidsCount === 1 ? "child" : "children"}
                  </strong>
                  <p className="text-muted-foreground mt-0.5 text-xs">
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
              <p className="text-center text-xs text-muted-foreground py-1">
                Tap one or more age stages above to indicate your kids.
              </p>
            )}
          </div>
        )}

        {/* Continue Button */}
        <div className="pt-2 space-y-3">
          <Button
            onClick={handleContinue}
            disabled={!canContinue || loading}
            className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Saving..." : "Continue to Preferences →"}
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
    </div>
  );
};

export default Kids;

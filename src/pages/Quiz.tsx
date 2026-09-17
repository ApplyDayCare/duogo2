import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { PartyPopper, ArrowLeft, Check, Sparkles, Compass } from "lucide-react";
import { getSignupDraft, updateSignupDraft, syncSignupDraftToSupabase, clearSignupDraft } from "@/lib/signupState";
import {
  compileQuizDimensions,
  saveUserQuizResponse,
  getSavedQuizAnswers,
  saveSavedQuizAnswers,
  reconstructAnswersFromDimensions,
  VIBE_QUESTION_KEYS,
  LIFESTYLE_QUESTION_KEYS,
  DetailedQuizAnswers,
} from "@/lib/quizSync";
import { triggerInstantMatchCheck } from "@/lib/matchEngine";

type QuestionType = "personality_choice" | "multi_chips" | "scale_5";

interface ChipOption {
  id: string;
  label: string;
  emoji: string;
}

interface ChoiceOption {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  value: number;
}

interface BaseQuestion {
  key: string;
  category: string;
  question: string;
  type: QuestionType;
  subtitle?: string;
  maxSelection?: number;
  chipOptions?: ChipOption[];
  choiceOptions?: ChoiceOption[];
  leftLabel?: string;
  rightLabel?: string;
}

const FREE_TIME_OPTIONS: ChipOption[] = [
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "traveling", label: "Traveling", emoji: "✈️" },
  { id: "cooking_food", label: "Cooking & Food", emoji: "🍳" },
  { id: "tea_coffee", label: "Tea & Coffee", emoji: "☕" },
  { id: "reading", label: "Reading Books", emoji: "📚" },
  { id: "art_design", label: "Art & Design", emoji: "🎨" },
  { id: "movies_series", label: "Movies & Series", emoji: "🎬" },
  { id: "fitness", label: "Running or Fitness", emoji: "🏃" },
  { id: "yoga_meditation", label: "Yoga & Meditation", emoji: "🧘" },
  { id: "nature_hiking", label: "Nature & Hiking", emoji: "🌿" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "languages", label: "Languages & Culture", emoji: "💬" },
  { id: "pets", label: "Pet Lover", emoji: "🐾" },
  { id: "tech", label: "Tech & Innovation", emoji: "💡" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "mixology", label: "Mixology", emoji: "🍸" },
  { id: "wine", label: "Wine", emoji: "🍷" },
  { id: "beers", label: "Beers", emoji: "🍺" },
  { id: "psychology", label: "Psychology & Self-growth", emoji: "🧠" },
  { id: "volunteering", label: "Volunteering & Social Causes", emoji: "🤝" },
  { id: "board_games", label: "Board Games & Trivia Nights", emoji: "🎲" },
];

const FRIEND_QUALITIES_OPTIONS: ChipOption[] = [
  { id: "authentic", label: "Authentic", emoji: "🌟" },
  { id: "attentive", label: "Attentive", emoji: "👀" },
  { id: "charismatic", label: "Charismatic", emoji: "🤩" },
  { id: "grounded", label: "Grounded", emoji: "🌿" },
  { id: "compelling", label: "Compelling", emoji: "⚡" },
  { id: "funny", label: "Funny", emoji: "😂" },
  { id: "intelligent", label: "Intelligent", emoji: "🧠" },
  { id: "warm", label: "Warm", emoji: "🔥" },
  { id: "stylish", label: "Stylish", emoji: "😎" },
  { id: "optimistic", label: "Optimistic", emoji: "🌈" },
];

const PERSONALITY_ENERGY_OPTIONS: ChoiceOption[] = [
  {
    id: "introverted",
    title: "Introverted",
    desc: "recharge by being alone",
    emoji: "🟩",
    value: 1,
  },
  {
    id: "ambivert",
    title: "Ambivert",
    desc: "a bit of both",
    emoji: "🟣",
    value: 3,
  },
  {
    id: "extroverted",
    title: "Extroverted",
    desc: "energized by people",
    emoji: "🪩",
    value: 5,
  },
];

const QUESTIONS: BaseQuestion[] = [
  {
    key: "q1_personality_energy",
    category: "Personality",
    question: "Are you more",
    type: "personality_choice",
    choiceOptions: PERSONALITY_ENERGY_OPTIONS,
  },
  {
    key: "q2_free_time",
    category: "Interests",
    question: "What do you enjoy doing in your free time?",
    subtitle: "Select up to 5",
    type: "multi_chips",
    maxSelection: 5,
    chipOptions: FREE_TIME_OPTIONS,
  },
  {
    key: "q3_friend_qualities",
    category: "Personality",
    question: "Which qualities do you value most in a friend?",
    subtitle: "Select up to 3",
    type: "multi_chips",
    maxSelection: 3,
    chipOptions: FRIEND_QUALITIES_OPTIONS,
  },
  {
    key: "q4_family_importance",
    category: "Personality",
    question: "How important is family to you?",
    type: "scale_5",
    leftLabel: "Not important",
    rightLabel: "Very important",
  },
  {
    key: "q5_conversation_depth",
    category: "Communication",
    question: "Conversation style & depth?",
    type: "scale_5",
    leftLabel: "Deep talks about life & dreams",
    rightLabel: "Banter, memes & lighthearted fun",
  },
  {
    key: "q6_budget",
    category: "Lifestyle",
    question: "Going out budget style?",
    type: "scale_5",
    leftLabel: "Street food, casual spots & picnics",
    rightLabel: "Sit-down dining & cocktail bars",
  },
  {
    key: "q7_activity_vs_sitting",
    category: "Social Vibe",
    question: "Preferred hangout activity?",
    type: "scale_5",
    leftLabel: "Relaxing, food & catching up",
    rightLabel: "Active exploring (hikes, sports, games)",
  },
  {
    key: "q8_spontaneity",
    category: "Lifestyle",
    question: "Making plans & spontaneity?",
    type: "scale_5",
    leftLabel: "Planned a week in advance",
    rightLabel: "Spontaneous / free in 20 mins",
  },
  {
    key: "q9_drinking_nightlife",
    category: "Lifestyle",
    question: "Nightlife & evening pace?",
    type: "scale_5",
    leftLabel: "Home by 10pm, cozy tea & movies",
    rightLabel: "Out until late, live music & events",
  },
  {
    key: "q10_political_openness",
    category: "Values",
    question: "Sharing similar worldview & core values?",
    type: "scale_5",
    leftLabel: "Doesn't matter if we click",
    rightLabel: "Very important to share core values",
  },
];

const STORAGE_KEY = "duogo_quiz_progress_v2";

const Quiz = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get("section") as "vibe" | "lifestyle" | null;

  // Filter active questions based on section query param
  const activeQuestions = useMemo(() => {
    if (sectionParam === "vibe") {
      return QUESTIONS.filter((q) => VIBE_QUESTION_KEYS.includes(q.key));
    }
    if (sectionParam === "lifestyle") {
      return QUESTIONS.filter((q) => LIFESTYLE_QUESTION_KEYS.includes(q.key));
    }
    return QUESTIONS;
  }, [sectionParam]);

  const [currentQ, setCurrentQ] = useState(0);

  // Scaled answers (1-5)
  const [scaleAnswers, setScaleAnswers] = useState<Record<string, number>>({});
  // Multi chips
  const [chipAnswers, setChipAnswers] = useState<Record<string, string[]>>({});
  // Personality choice
  const [personalityChoice, setPersonalityChoice] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // Load from saved answers or draft on mount
  useEffect(() => {
    let isMounted = true;
    async function loadQuizData() {
      try {
        const draft = getSignupDraft();
        if (draft.free_time_interests) {
          setChipAnswers((prev) => ({ ...prev, q2_free_time: draft.free_time_interests || [] }));
        }
        if (draft.friend_qualities) {
          setChipAnswers((prev) => ({ ...prev, q3_friend_qualities: draft.friend_qualities || [] }));
        }
        if (draft.personality_energy) {
          setPersonalityChoice(draft.personality_energy);
        }
        if (draft.family_importance) {
          setScaleAnswers((prev) => ({ ...prev, q4_family_importance: draft.family_importance || 3 }));
        }

        const saved = getSavedQuizAnswers(user?.id);
        if (saved && isMounted) {
          if (saved.scaleAnswers) setScaleAnswers((prev) => ({ ...prev, ...saved.scaleAnswers }));
          if (saved.chipAnswers) setChipAnswers((prev) => ({ ...prev, ...saved.chipAnswers }));
          if (saved.personalityChoice) setPersonalityChoice(saved.personalityChoice);
        }

        // If authenticated and no cached answers, reconstruct from supabase quiz_responses
        if (user && (!saved || Object.keys(saved.scaleAnswers || {}).length === 0)) {
          const { data: dbResp } = await supabase
            .from("quiz_responses")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (dbResp && isMounted) {
            const reconstructed = reconstructAnswersFromDimensions(dbResp as any);
            setScaleAnswers((prev) => ({ ...reconstructed.scaleAnswers, ...prev }));
            setChipAnswers((prev) => ({ ...reconstructed.chipAnswers, ...prev }));
            if (reconstructed.personalityChoice) {
              setPersonalityChoice((prev) => prev || reconstructed.personalityChoice!);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load quiz progress:", e);
      }
    }

    loadQuizData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ scaleAnswers, chipAnswers, personalityChoice, currentQ, introSeen: !showIntro })
    );
  }, [scaleAnswers, chipAnswers, personalityChoice, currentQ, showIntro]);

  const q = activeQuestions[currentQ] || activeQuestions[0];

  // Helper check if current question has an answer
  const isCurrentQuestionAnswered = () => {
    if (!q) return false;
    if (q.type === "personality_choice") {
      return Boolean(personalityChoice);
    }
    if (q.type === "multi_chips") {
      const selected = chipAnswers[q.key] || [];
      return selected.length > 0;
    }
    if (q.type === "scale_5") {
      return scaleAnswers[q.key] !== undefined;
    }
    return false;
  };

  const handleSelectPersonality = (opt: ChoiceOption) => {
    setPersonalityChoice(opt.id);
    setScaleAnswers((prev) => ({ ...prev, [q.key]: opt.value }));
  };

  const handleToggleChip = (chipId: string, max: number) => {
    setChipAnswers((prev) => {
      const currentList = prev[q.key] || [];
      if (currentList.includes(chipId)) {
        return { ...prev, [q.key]: currentList.filter((id) => id !== chipId) };
      }
      if (currentList.length >= max) {
        return { ...prev, [q.key]: [...currentList.slice(1), chipId] };
      }
      return { ...prev, [q.key]: [...currentList, chipId] };
    });
  };

  const handleScaleAnswer = (val: number) => {
    setScaleAnswers((prev) => ({ ...prev, [q.key]: val }));
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setCurrentQ((prev) => prev - 1);
    } else {
      if (sectionParam) {
        navigate("/profile");
      } else {
        navigate("/onboarding/location");
      }
    }
  };

  const handleNext = async () => {
    if (currentQ < activeQuestions.length - 1) {
      setCurrentQ((p) => p + 1);
      return;
    }

    // Last question: handle completion
    setSaving(true);
    try {
      // Get base previous answers to merge and keep other section intact
      const previous = getSavedQuizAnswers(user?.id);
      const mergedScale = { ...(previous?.scaleAnswers || {}), ...scaleAnswers };
      const mergedChips = { ...(previous?.chipAnswers || {}), ...chipAnswers };
      const mergedPersonality = personalityChoice || previous?.personalityChoice || "ambivert";

      const quizDimensions = compileQuizDimensions(
        mergedScale,
        mergedChips,
        mergedPersonality
      );

      const detailedState: DetailedQuizAnswers = {
        scaleAnswers: mergedScale,
        chipAnswers: mergedChips,
        personalityChoice: mergedPersonality,
      };

      updateSignupDraft({
        personality_energy: mergedPersonality,
        free_time_interests: mergedChips.q2_free_time || [],
        friend_qualities: mergedChips.q3_friend_qualities || [],
        family_importance: mergedScale.q4_family_importance || 3,
        quiz_answers: quizDimensions as any,
        quiz_completed: true,
        onboarding_completed: true,
      });

      if (!user) {
        // Unauthenticated signup flow -> save draft and proceed to data privacy consent
        localStorage.removeItem(STORAGE_KEY);
        setSaving(false);
        navigate("/onboarding/privacy-consent");
        return;
      }

      // User is already authenticated -> save to Supabase
      let coupleId: string | null = null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.user_type === "couple") {
        const { data: couple } = await supabase
          .from("couples")
          .select("id")
          .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
          .maybeSingle();
        coupleId = couple?.id ?? null;
      }

      const saveRes = await saveUserQuizResponse(user.id, coupleId, quizDimensions, detailedState);
      if (!saveRes.ok) {
        console.warn("Quiz save notice:", saveRes.error);
      }

      // Update draft first so syncSignupDraftToSupabase knows quiz and onboarding are done
      updateSignupDraft({
        quiz_completed: true,
        onboarding_completed: true,
        privacy_consented: true,
      });

      // Explicitly update Supabase profiles with quiz_completed, privacy_consented, AND onboarding_completed
      const profileUpdates = {
        quiz_completed: true,
        privacy_consented: true,
        onboarding_completed: true,
        last_active: new Date().toISOString(),
      };

      const { error: profileUpdateErr } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);

      if (profileUpdateErr) {
        console.warn("Profile update notice, trying upsert fallback:", profileUpdateErr.message);
        await supabase
          .from("profiles")
          .upsert({ id: user.id, email: user.email, ...profileUpdates } as any, { onConflict: "id" });
      }

      // Sync signup draft to Supabase to guarantee all fields are persisted
      await syncSignupDraftToSupabase(user);

      // Refresh AuthContext profile so isProfileComplete becomes true immediately
      await refreshProfile();

      // Clear the local signup draft
      clearSignupDraft();

      // Trigger instant match detection immediately
      triggerInstantMatchCheck();

      localStorage.removeItem(STORAGE_KEY);
      setSaving(false);

      if (sectionParam) {
        const title =
          sectionParam === "vibe"
            ? "Vibe Quiz Updated! ✨"
            : "Lifestyle Quiz Updated! 🌿";
        toast({
          title,
          description: "Your responses and match recommendations have been refreshed.",
        });
        navigate("/profile");
      } else {
        toast({
          title: "Onboarding & Quiz Complete! 🎉",
          description: "Welcome to duogo! Unlocking your friendship matches...",
        });
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      setSaving(false);
      toast({ title: "Error saving quiz", description: err.message, variant: "destructive" });
    }
  };

  // Completion screen for authenticated user
  if (showComplete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-card">
            <CardContent className="space-y-6 pt-10 pb-8 px-6">
              <PartyPopper className="mx-auto h-16 w-16 text-primary" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Quiz complete!</h1>
                <p className="text-muted-foreground text-sm">We're finding your best friendship matches...</p>
              </div>
              <Button className="h-12 w-full text-base font-semibold rounded-full shadow-sm" onClick={() => navigate("/matches")}>
                See My Matches
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f4] dark:bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Lifestyle & Personality Quiz</h1>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Answer honestly: there are no right answers. We're finding people who actually match your vibe, values, and hangout preferences.
            </p>
          </div>
          <Button className="h-12 w-full text-base font-semibold rounded-full shadow-sm" onClick={() => setShowIntro(false)}>
            Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentQ + 1) / activeQuestions.length) * 100;
  const answered = isCurrentQuestionAnswered();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] dark:bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl space-y-6">
        {/* Header navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            {sectionParam === "vibe" && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3 text-amber-500" /> Vibe Focus
              </span>
            )}
            {sectionParam === "lifestyle" && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <Compass className="h-3 w-3 text-emerald-500" /> Lifestyle Focus
              </span>
            )}
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF5436] bg-[#FFF0EB] border border-[#FFD9CE] px-3 py-0.5 rounded-full">
              Question {currentQ + 1} of {activeQuestions.length}
            </span>
          </div>
        </div>

        {/* Progress Bar with Coral Fill */}
        <div className="h-2 w-full bg-[#EFE8DD] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF5436] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card overflow-hidden">
          <CardContent className="space-y-7 pt-8 pb-9 px-6 sm:px-10">
            {/* Question Title */}
            <div className="space-y-2 text-center">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF5436]">
                {q.category}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#1A1816]">
                {q.question}
              </h2>
              {q.subtitle && (
                <p className="text-xs sm:text-sm font-medium text-[#706A62]">
                  {q.subtitle}
                  {q.type === "multi_chips" && chipAnswers[q.key]?.length > 0 && (
                    <span className="ml-2 font-bold text-[#FF5436]">
                      • {chipAnswers[q.key].length} selected
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Layout 1: Personality Choice (Introvert / Ambivert / Extrovert) */}
            {q.type === "personality_choice" && q.choiceOptions && (
              <div className="space-y-3 pt-2">
                {q.choiceOptions.map((opt) => {
                  const isSelected = personalityChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPersonality(opt)}
                      className={`w-full text-left flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 ${
                        isSelected
                          ? "border-[#FF5436] bg-[#FFF8F5] shadow-xs"
                          : "border-[#EFE8DD] bg-[#FAF7F2]/60 hover:border-[#DECBBF] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-2xl shrink-0" role="img">
                          {opt.emoji}
                        </span>
                        <div>
                          <span className="font-serif font-bold text-[#1A1816] text-base sm:text-lg block leading-snug">
                            {opt.title}
                          </span>
                          <span className="text-xs text-[#706A62]">
                            {opt.desc}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 ml-3">
                        {isSelected ? (
                          <div className="h-6 w-6 rounded-full bg-[#FF5436] flex items-center justify-center text-white shadow-2xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-[#D6CEC4]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Layout 2: Multi-select Chips (Free time hobbies & Friend qualities) */}
            {q.type === "multi_chips" && q.chipOptions && (
              <div className="flex flex-wrap gap-2.5 justify-center pt-2 max-h-[380px] overflow-y-auto pr-1">
                {q.chipOptions.map((chip) => {
                  const isSelected = (chipAnswers[q.key] || []).includes(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleToggleChip(chip.id, q.maxSelection || 5)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold border-2 transition-all select-none active:scale-95 ${
                        isSelected
                          ? "border-[#FF5436] bg-[#FF5436] text-white shadow-[0_4px_12px_rgba(255,84,54,0.28)]"
                          : "border-[#EFE8DD] bg-white text-[#4A4540] hover:border-[#DECBBF] hover:bg-[#FAF7F2]"
                      }`}
                    >
                      <span className="text-base" role="img">
                        {chip.emoji}
                      </span>
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Layout 3: 5-Point Scale Blocks */}
            {q.type === "scale_5" && (
              <div className="space-y-4 pt-2">
                <div className="flex justify-between text-xs text-[#706A62] px-1 font-semibold">
                  <span className="max-w-[44%] text-left">{q.leftLabel}</span>
                  <span className="max-w-[44%] text-right">{q.rightLabel}</span>
                </div>

                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isSelected = scaleAnswers[q.key] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleScaleAnswer(val)}
                        className={`flex h-14 sm:h-16 flex-col items-center justify-center rounded-2xl border-2 text-base sm:text-lg font-bold transition-all active:scale-95 ${
                          isSelected
                            ? "border-[#FF5436] bg-[#FF5436] text-white shadow-[0_4px_12px_rgba(255,84,54,0.32)]"
                            : "border-[#EFE8DD] bg-[#FAF7F2]/70 hover:border-[#DECBBF] hover:bg-white text-[#1A1816]"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Continue / Next Button */}
            <div className="pt-2">
              <Button
                className="h-13 w-full text-base font-bold rounded-full bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] hover:shadow-[0_10px_24px_rgba(255,84,54,0.42)] transition-all"
                disabled={!answered || saving}
                onClick={handleNext}
              >
                {saving
                  ? "Saving..."
                  : currentQ < activeQuestions.length - 1
                  ? "Next Question →"
                  : "Finish & Save Profile →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quiz;

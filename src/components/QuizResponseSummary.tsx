import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Sparkles,
  Compass,
  RefreshCcw,
  Zap,
  Coffee,
  Wine,
  Moon,
  Home,
  Users,
  CheckCircle2,
  Smile,
  Handshake,
  ArrowRight,
  HelpCircle,
  Sliders,
  Flame,
} from "lucide-react";
import {
  QuizDimensions,
  determineVibeArchetype,
  getSavedQuizAnswers,
  reconstructAnswersFromDimensions,
  DetailedQuizAnswers,
  VibeArchetype,
} from "@/lib/quizSync";
import { DIMENSION_LABELS, DIMENSION_TAGS } from "@/lib/matchUtils";

// Human-readable labels for free-time hobbies
const HOBBY_LABELS: Record<string, { label: string; emoji: string }> = {
  tea_coffee: { label: "Tea & Specialty Coffee", emoji: "☕" },
  nature_walks: { label: "Scenic Walks & Parks", emoji: "🌿" },
  trying_restaurants: { label: "Trying New Restaurants", emoji: "🍜" },
  live_music: { label: "Concerts & Live Music", emoji: "🎵" },
  fitness_sports: { label: "Fitness & Workouts", emoji: "🏃" },
  reading_books: { label: "Reading & Bookstores", emoji: "📚" },
  museums_galleries: { label: "Museums & Art", emoji: "🎨" },
  cooking_dinner: { label: "Cooking & Dinner Parties", emoji: "🍳" },
  board_games: { label: "Board Games & Trivia", emoji: "🎲" },
  thrifting_markets: { label: "Thrifting & Markets", emoji: "🛍️" },
  bouldering_hiking: { label: "Bouldering & Hiking", emoji: "🧗" },
  chill_couch: { label: "Cozy Shows & Movies", emoji: "🛋️" },
  music: { label: "Music & Playlists", emoji: "🎧" },
  cooking_food: { label: "Culinary Adventures", emoji: "🍲" },
};

// Human-readable labels for friend qualities
const FRIEND_QUALITY_LABELS: Record<string, { label: string; emoji: string }> = {
  authentic: { label: "Authentic & Genuine", emoji: "✨" },
  funny: { label: "Funny & Playful Wit", emoji: "😂" },
  grounded: { label: "Grounded & Low-Drama", emoji: "🌱" },
  active_energetic: { label: "Active & Spontaneous", emoji: "⚡" },
  deep_thinker: { label: "Deep & Thoughtful", emoji: "💡" },
  good_listener: { label: "Attentive Listener", emoji: "👂" },
  reliable: { label: "Reliable & Punctual", emoji: "🤝" },
  culturally_curious: { label: "Culturally Curious", emoji: "🌍" },
};

interface QuizResponseSummaryProps {
  userId: string;
  initialDimensions?: QuizDimensions | null;
  className?: string;
  onRetakeStarted?: () => void;
}

export const QuizResponseSummary = ({
  userId,
  initialDimensions,
  className = "",
  onRetakeStarted,
}: QuizResponseSummaryProps) => {
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState<QuizDimensions | null>(initialDimensions || null);
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedQuizAnswers | null>(null);
  const [loading, setLoading] = useState(!initialDimensions);
  const [activeTab, setActiveTab] = useState<string>("vibe");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Load detailed answers from storage first
        let detailed = getSavedQuizAnswers(userId);

        // Fetch quiz_responses dimensions if not passed or needed
        let dims = initialDimensions;
        if (!dims) {
          const { data, error } = await supabase
            .from("quiz_responses")
            .select(
              "dimension_1_social, dimension_2_budget, dimension_3_spontaneity, dimension_4_planning, dimension_5_intellectual, dimension_6_activity, dimension_7_alcohol, dimension_8_humor, dimension_9_commitment, dimension_10_home"
            )
            .eq("user_id", userId)
            .maybeSingle();

          if (data && !error && data.dimension_1_social !== null) {
            dims = data as unknown as QuizDimensions;
          }
        }

        // If we have dimensions but missing detailed answers, reconstruct fallback detailed answers
        if (dims && (!detailed || Object.keys(detailed.scaleAnswers || {}).length === 0)) {
          detailed = reconstructAnswersFromDimensions(dims);
        }

        if (isMounted) {
          setDimensions(dims || null);
          setDetailedAnswers(detailed || null);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Error loading quiz response summary:", e);
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, initialDimensions]);

  const handleRetakeSection = (section: "vibe" | "lifestyle" | "all") => {
    if (onRetakeStarted) onRetakeStarted();
    if (section === "all") {
      navigate("/quiz");
    } else {
      navigate(`/quiz?section=${section}`);
    }
  };

  if (loading) {
    return (
      <Card className={`border border-[#EFE8DD] rounded-3xl bg-white dark:bg-card p-8 text-center space-y-4 ${className}`}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Loading lifestyle & vibe profile...
        </p>
      </Card>
    );
  }

  // If no responses exist yet
  if (!dimensions) {
    return (
      <Card className={`border-2 border-dashed border-[#E5DFD5] rounded-3xl bg-[#FAF8F5] dark:bg-card p-6 sm:p-8 text-center space-y-4 ${className}`}>
        <div className="mx-auto h-12 w-12 rounded-2xl bg-[#FFF0EB] flex items-center justify-center text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-serif text-xl font-bold text-[#191715] dark:text-foreground">
            No Quiz Responses Yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Take our 3-minute lifestyle & vibe quiz to uncover your social archetype and unlock high-accuracy friend matches!
          </p>
        </div>
        <Button
          onClick={() => handleRetakeSection("all")}
          className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-md"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          Take 3-Minute Quiz
        </Button>
      </Card>
    );
  }

  const archetype: VibeArchetype = determineVibeArchetype(dimensions);

  // Derive descriptors from dimensions
  const socialLevel = dimensions.dimension_1_social || 3;
  const budgetLevel = dimensions.dimension_2_budget || 3;
  const spontaneityLevel = dimensions.dimension_3_spontaneity || 3;
  const convDepthLevel = dimensions.dimension_5_intellectual || 3;
  const activityLevel = dimensions.dimension_6_activity || 3;
  const nightlifeLevel = dimensions.dimension_7_alcohol || 3;
  const valuesLevel = dimensions.dimension_9_commitment || 3;
  const homeLevel = dimensions.dimension_10_home || 3;

  // Selected hobbies and qualities
  const selectedHobbies = detailedAnswers?.chipAnswers?.q2_free_time || [
    "tea_coffee",
    "nature_walks",
    "trying_restaurants",
  ];
  const selectedQualities = detailedAnswers?.chipAnswers?.q3_friend_qualities || [
    "authentic",
    "grounded",
    "funny",
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Archetype Hero Card */}
      <Card className="border border-[#EFE8DD] shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-3xl bg-white dark:bg-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#FFF6F2] via-[#FAF6F0] to-[#F5EFE6] dark:from-primary/10 dark:via-background dark:to-background p-5 sm:p-7 border-b border-[#EFE8DD]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white dark:bg-card shadow-xs border border-[#EFE8DD] flex items-center justify-center text-2xl sm:text-3xl shrink-0">
                  {archetype.emoji}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0EB] border border-[#FFD9CE] px-2.5 py-0.5 text-[11px] font-bold text-[#FF5436] whitespace-nowrap">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>Your Connection Archetype</span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816] dark:text-foreground">
                    {archetype.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-[#706A62] dark:text-muted-foreground">
                    {archetype.tagline}
                  </p>
                </div>
              </div>

              {/* Quick Retake Dropdown / Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap pt-1 sm:pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetakeSection("vibe")}
                  className="rounded-full text-xs font-bold border-[#EFE8DD] hover:border-[#FF5436] hover:bg-[#FFF9F7] text-[#1A1816] dark:text-foreground h-8 px-3 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#FF5436] mr-1 shrink-0" />
                  Retake Vibe
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetakeSection("lifestyle")}
                  className="rounded-full text-xs font-bold border-[#EFE8DD] hover:border-emerald-600 hover:bg-emerald-50/50 text-[#1A1816] dark:text-foreground h-8 px-3 whitespace-nowrap"
                >
                  <Compass className="h-3.5 w-3.5 text-emerald-600 mr-1 shrink-0" />
                  Retake Lifestyle
                </Button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#4A443C] dark:text-foreground/90 leading-relaxed">
              {archetype.summary}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {archetype.traits.map((trait) => (
                <span
                  key={trait}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white dark:bg-card border border-[#EFE8DD] text-[#4A443C] dark:text-foreground shadow-2xs"
                >
                  <CheckCircle2 className="h-3 w-3 text-[#FF5436]" />
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabbed Detailed Breakdown */}
        <CardContent className="p-5 sm:p-7 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col space-y-3 border-b border-[#EFE8DD] pb-4">
              <div>
                <h4 className="font-serif text-lg font-bold text-[#1A1816] dark:text-foreground">
                  Quiz Response Breakdown
                </h4>
                <p className="text-xs text-[#706A62] dark:text-muted-foreground">
                  Compare your responses across social vibe, everyday lifestyle, and dimensional scores.
                </p>
              </div>

              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <TabsList className="bg-[#FAF7F2] dark:bg-muted p-1 rounded-full border border-[#EFE8DD] inline-flex w-auto min-w-full sm:min-w-0">
                  <TabsTrigger
                    value="vibe"
                    className="rounded-full text-xs font-bold px-3.5 py-1.5 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-[#FF5436] data-[state=active]:shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Vibe & Energy
                  </TabsTrigger>
                  <TabsTrigger
                    value="lifestyle"
                    className="rounded-full text-xs font-bold px-3.5 py-1.5 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs"
                  >
                    <Compass className="h-3.5 w-3.5 mr-1" />
                    Lifestyle & Routine
                  </TabsTrigger>
                  <TabsTrigger
                    value="radar"
                    className="rounded-full text-xs font-bold px-3.5 py-1.5 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-[#1A1816] data-[state=active]:shadow-xs"
                  >
                    <Sliders className="h-3.5 w-3.5 mr-1" />
                    10 Dimensions
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* TAB 1: VIBE & ENERGY */}
            <TabsContent value="vibe" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Social Energy Battery */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      Social Battery & Energy
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {socialLevel <= 2
                        ? "Introvert"
                        : socialLevel >= 4
                        ? "Extrovert"
                        : "Ambivert"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {socialLevel <= 2
                      ? "Recharges with quiet solo time & low-pressure 1-on-1 gatherings"
                      : socialLevel >= 4
                      ? "Energized by lively rooms, group meetups, and frequent social catchups"
                      : "Balanced energy: equally comfortable hanging with groups or enjoying solo chill time"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(socialLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Conversation Style */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Smile className="h-3.5 w-3.5 text-amber-600" />
                      Conversation Style
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {convDepthLevel >= 4
                        ? "Deep & Thoughtful"
                        : convDepthLevel <= 2
                        ? "Playful & Light"
                        : "Rich & Balanced"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {convDepthLevel >= 4
                      ? "Prefers life philosophies, vulnerable stories & intellectual deep-dives"
                      : convDepthLevel <= 2
                      ? "Enjoys effortless banter, witty jokes, viral memes & easy laughs"
                      : "Seamlessly switches between hilarious banter and sincere meaningful talks"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${(convDepthLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Hangout Dynamic */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-600" />
                      Hangout Pace & Activity
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {activityLevel >= 4
                        ? "Active & Moving"
                        : activityLevel <= 2
                        ? "Relaxed & Sitting"
                        : "Flexible Mix"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {activityLevel >= 4
                      ? "Loves outdoor sports, hikes, walking tours, and energetic movement"
                      : activityLevel <= 2
                      ? "Prefers relaxed cafes, long dinners, cozy lounges, and great conversation"
                      : "Down for an active adventure or a leisurely coffee sit-down"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${(activityLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Valued Friend Qualities */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5 text-primary" />
                    Valued Friend Qualities
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedQualities.map((key) => {
                      const item = FRIEND_QUALITY_LABELS[key] || { label: key, emoji: "✨" };
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white dark:bg-card border border-[#DECBBF] text-[#191715] dark:text-foreground"
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Free-Time Interests */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-primary" />
                  Your Chosen Free-Time Passions
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedHobbies.map((key) => {
                    const item = HOBBY_LABELS[key] || { label: key.replace(/_/g, " "), emoji: "🎯" };
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FAF7F2] dark:bg-muted border border-[#EFE8DD] text-[#191715] dark:text-foreground shadow-2xs"
                      >
                        <span className="text-sm">{item.emoji}</span>
                        <span>{item.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Action Banner for Vibe */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    Feel like your social energy or hangout style has changed? You can retake just the 5 vibe questions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRetakeSection("vibe")}
                  className="rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0"
                >
                  Retake Vibe Quiz
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: LIFESTYLE & ROUTINE */}
            <TabsContent value="lifestyle" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Budget Style */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Coffee className="h-3.5 w-3.5 text-emerald-600" />
                      Going-Out Budget Style
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {budgetLevel >= 4
                        ? "Fine Dining & Cocktails"
                        : budgetLevel <= 2
                        ? "Street Food & Casual"
                        : "Balanced Range"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {budgetLevel >= 4
                      ? "Loves curated tasting menus, cocktail lounges, and standout culinary experiences"
                      : budgetLevel <= 2
                      ? "Prefers casual food trucks, local coffee shops, picnics, and low-cost outings"
                      : "Enjoys casual taco spots during the week and occasional nice dinners on weekends"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${(budgetLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Spontaneity vs Planning */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-blue-600" />
                      Spontaneity & Planning
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {spontaneityLevel >= 4
                        ? "Spontaneous Spirit"
                        : spontaneityLevel <= 2
                        ? "Structured Planner"
                        : "Adaptable"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {spontaneityLevel >= 4
                      ? "Ready on 20 minutes notice: loves impromptu ideas and unplanned adventures"
                      : spontaneityLevel <= 2
                      ? "Prefers plans on the calendar a week in advance with clear itineraries"
                      : "Comfortable with advance weekend plans or spontaneous weeknight invites"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${(spontaneityLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Nightlife & Evening Pace */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5 text-indigo-600" />
                      Nightlife & Evening Pace
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {nightlifeLevel >= 4
                        ? "Night Owl"
                        : nightlifeLevel <= 2
                        ? "Early Bird"
                        : "Flexible Evenings"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {nightlifeLevel >= 4
                      ? "Thrives after sunset: concerts, dynamic bars, live events & late gatherings"
                      : nightlifeLevel <= 2
                      ? "Cozy tea in bed by 10 PM: mornings are precious, early starts preferred"
                      : "Up for a lively Saturday night, but equally loves relaxed quiet evenings"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${(nightlifeLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Home Hangouts vs City Exploring */}
                <div className="p-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/50 dark:bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-teal-600" />
                      Home Sanctuary vs City Outings
                    </span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {homeLevel >= 4
                        ? "Homebody Host"
                        : homeLevel <= 2
                        ? "City Explorer"
                        : "Balanced"}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#191715] dark:text-foreground">
                    {homeLevel >= 4
                      ? "Loves hosting at home, potluck dinners, games nights, and cozy domestic warmth"
                      : homeLevel <= 2
                      ? "Loves being out in the city: street festivals, venues, markets, and public squares"
                      : "Enjoys both hosting intimate dinners and discovering neighborhood spots"}
                  </p>
                  <div className="h-2 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full transition-all"
                      style={{ width: `${(homeLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Banner for Lifestyle */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Compass className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">
                    Changed your spending habits, routine, or weekend pace? Retake just the 5 lifestyle questions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRetakeSection("lifestyle")}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                >
                  Retake Lifestyle Quiz
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3: 10 DIMENSIONS RADAR */}
            <TabsContent value="radar" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(DIMENSION_TAGS).map(([dimKey, meta]) => {
                  const dimNum = parseInt(dimKey, 10);
                  const keyName = `dimension_${dimNum}_${
                    dimNum === 1
                      ? "social"
                      : dimNum === 2
                      ? "budget"
                      : dimNum === 3
                      ? "spontaneity"
                      : dimNum === 4
                      ? "planning"
                      : dimNum === 5
                      ? "intellectual"
                      : dimNum === 6
                      ? "activity"
                      : dimNum === 7
                      ? "alcohol"
                      : dimNum === 8
                      ? "humor"
                      : dimNum === 9
                      ? "commitment"
                      : "home"
                  }` as keyof QuizDimensions;

                  const score = dimensions[keyName] || 3;
                  const label = DIMENSION_LABELS[dimNum] || meta.label;

                  return (
                    <div
                      key={dimKey}
                      className="p-3.5 rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]/40 dark:bg-muted/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base" role="img">
                            {meta.emoji}
                          </span>
                          <span className="text-xs font-bold text-[#191715] dark:text-foreground">
                            {label}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-primary bg-[#FFF0EB] border border-[#FFD9CE] px-2 py-0.5 rounded-full">
                          {score}/5
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EFE8DD] dark:bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom Retake Actions Hub */}
          <div className="pt-4 border-t border-[#EFE8DD]">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Manage & Retake Your Quizzes
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Button 1: Retake Vibe */}
                <button
                  type="button"
                  onClick={() => handleRetakeSection("vibe")}
                  className="p-3.5 rounded-2xl border-2 border-[#EFE8DD] hover:border-[#FF5436]/50 bg-[#FAF7F2]/60 hover:bg-[#FFF9F7] transition-all text-left flex flex-col justify-between group cursor-pointer active:scale-[0.98]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Sparkles className="h-4 w-4 text-[#FF5436]" />
                      <ArrowRight className="h-4 w-4 text-[#A8A096] group-hover:text-[#FF5436] transition-colors" />
                    </div>
                    <span className="font-serif font-bold text-sm text-[#1A1816] dark:text-foreground block">
                      Retake Vibe Quiz
                    </span>
                    <span className="text-[11px] text-[#706A62] dark:text-muted-foreground block leading-tight">
                      5 questions · Energy, conversation & friend qualities
                    </span>
                  </div>
                </button>

                {/* Button 2: Retake Lifestyle */}
                <button
                  type="button"
                  onClick={() => handleRetakeSection("lifestyle")}
                  className="p-3.5 rounded-2xl border-2 border-[#EFE8DD] hover:border-emerald-500/50 bg-[#FAF7F2]/60 hover:bg-emerald-50/40 transition-all text-left flex flex-col justify-between group cursor-pointer active:scale-[0.98]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Compass className="h-4 w-4 text-emerald-600" />
                      <ArrowRight className="h-4 w-4 text-[#A8A096] group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <span className="font-serif font-bold text-sm text-[#1A1816] dark:text-foreground block">
                      Retake Lifestyle Quiz
                    </span>
                    <span className="text-[11px] text-[#706A62] dark:text-muted-foreground block leading-tight">
                      5 questions · Budget, spontaneity & core values
                    </span>
                  </div>
                </button>

                {/* Button 3: Retake Full Quiz with Confirmation Dialog */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="p-3.5 rounded-2xl border-2 border-[#EFE8DD] hover:border-[#1A1816]/40 bg-[#FAF7F2]/60 hover:bg-[#F2ECE3] transition-all text-left flex flex-col justify-between group cursor-pointer active:scale-[0.98]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <RefreshCcw className="h-4 w-4 text-[#706A62]" />
                          <ArrowRight className="h-4 w-4 text-[#A8A096] group-hover:text-[#1A1816] transition-colors" />
                        </div>
                        <span className="font-serif font-bold text-sm text-[#1A1816] dark:text-foreground block">
                          Retake Both (Full Quiz)
                        </span>
                        <span className="text-[11px] text-[#706A62] dark:text-muted-foreground block leading-tight">
                          All 10 questions · Complete reset of lifestyle & vibe profile
                        </span>
                      </div>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border border-[#EFE8DD] bg-white dark:bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif text-xl font-bold">
                        Retake Full Compatibility Quiz?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm text-muted-foreground">
                        This will take you through all 10 questions of the complete Lifestyle & Vibe Quiz. Your existing answers will be prefilled so you can quickly adjust any preferences.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRetakeSection("all")}
                        className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold"
                      >
                        Start Full Quiz
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

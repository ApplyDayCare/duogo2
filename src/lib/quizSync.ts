import { supabase } from "@/integrations/supabase/client";

export interface QuizDimensions {
  dimension_1_social: number;
  dimension_2_budget: number;
  dimension_3_spontaneity: number;
  dimension_4_planning: number;
  dimension_5_intellectual: number;
  dimension_6_activity: number;
  dimension_7_alcohol: number;
  dimension_8_humor: number;
  dimension_9_commitment: number;
  dimension_10_home: number;
}

export function compileQuizDimensions(
  scaleAnswers: Record<string, number> = {},
  chipAnswers: Record<string, string[]> = {},
  personalityChoice?: string
): QuizDimensions {
  // Dimension 1: Social energy (1-5)
  let dim1 = 3;
  if (personalityChoice === "introverted") dim1 = 1;
  else if (personalityChoice === "ambivert") dim1 = 3;
  else if (personalityChoice === "extroverted") dim1 = 5;
  else if (scaleAnswers.q1_personality_energy) dim1 = scaleAnswers.q1_personality_energy;

  // Dimension 2: Budget (1-5)
  const dim2 = scaleAnswers.q6_budget || 3;

  // Dimension 3: Spontaneity (1-5)
  const dim3 = scaleAnswers.q8_spontaneity || 3;

  // Dimension 4: Planning (1-5) - inverse of pure spontaneity or structured
  const dim4 = Math.max(1, Math.min(5, 6 - dim3));

  // Dimension 5: Intellectual depth (1-5)
  // q5: 1 = deep life talks, 5 = banter/memes
  const convDepth = scaleAnswers.q5_conversation_depth || 3;
  const dim5 = Math.max(1, Math.min(5, 6 - convDepth));

  // Dimension 6: Activity level (1-5)
  const dim6 = scaleAnswers.q7_activity_vs_sitting || 3;

  // Dimension 7: Alcohol & nightlife (1-5)
  const dim7 = scaleAnswers.q9_drinking_nightlife || 3;

  // Dimension 8: Humor style (1-5)
  const qualities = chipAnswers.q3_friend_qualities || [];
  const hasFunny = qualities.includes("funny");
  const dim8 = Math.max(1, Math.min(5, convDepth + (hasFunny ? 1 : 0)));

  // Dimension 9: Commitment & family (1-5)
  const dim9 = scaleAnswers.q10_political_openness || scaleAnswers.q4_family_importance || 3;

  // Dimension 10: Home vs out (1-5)
  const dim10 = Math.max(1, Math.min(5, 6 - dim7));

  return {
    dimension_1_social: dim1,
    dimension_2_budget: dim2,
    dimension_3_spontaneity: dim3,
    dimension_4_planning: dim4,
    dimension_5_intellectual: dim5,
    dimension_6_activity: dim6,
    dimension_7_alcohol: dim7,
    dimension_8_humor: dim8,
    dimension_9_commitment: dim9,
    dimension_10_home: dim10,
  };
}

export const VIBE_QUESTION_KEYS = [
  "q1_personality_energy",
  "q2_free_time",
  "q3_friend_qualities",
  "q5_conversation_depth",
  "q7_activity_vs_sitting",
];

export const LIFESTYLE_QUESTION_KEYS = [
  "q6_budget",
  "q8_spontaneity",
  "q9_drinking_nightlife",
  "q4_family_importance",
  "q10_political_openness",
];

export interface DetailedQuizAnswers {
  scaleAnswers: Record<string, number>;
  chipAnswers: Record<string, string[]>;
  personalityChoice?: string;
  updatedAt?: string;
}

export interface VibeArchetype {
  title: string;
  emoji: string;
  tagline: string;
  summary: string;
  traits: string[];
}

export function determineVibeArchetype(dimensions: QuizDimensions): VibeArchetype {
  const d1 = dimensions.dimension_1_social || 3;
  const d2 = dimensions.dimension_2_budget || 3;
  const d3 = dimensions.dimension_3_spontaneity || 3;
  const d4 = dimensions.dimension_4_planning || 3;
  const d5 = dimensions.dimension_5_intellectual || 3;
  const d6 = dimensions.dimension_6_activity || 3;
  const d7 = dimensions.dimension_7_alcohol || 3;
  const d9 = dimensions.dimension_9_commitment || 3;
  const d10 = dimensions.dimension_10_home || 3;

  if (d6 >= 4 && d3 >= 4) {
    return {
      title: "Spontaneous Adventurer",
      emoji: "🌿",
      tagline: "High-energy, outdoor-loving & ready on short notice",
      summary: "You thrive on impromptu adventures, active outdoor exploration, and vibrant energy. You prefer exploring scenic trails, trying new activities, and connecting on the move.",
      traits: ["Active Outdoors", "Spontaneous", "Flexible Pace", "Action-Oriented"],
    };
  }

  if (d5 >= 4 && d10 >= 4) {
    return {
      title: "Cozy Intellectual",
      emoji: "📚",
      tagline: "Deep conversations, warm spaces & soulful connection",
      summary: "You value intimate gatherings, late-night philosophical discussions, comfortable cafes, and authentic bonds. You seek friends who appreciate genuine honesty and thoughtful dialogue.",
      traits: ["Deep Thinker", "Cozy Hangouts", "Intentional", "Warm Atmosphere"],
    };
  }

  if (d1 >= 4 && d7 >= 4) {
    return {
      title: "Nightlife Socialite",
      emoji: "🪩",
      tagline: "Vibrant weekends, live events & electric social energy",
      summary: "You are the heartbeat of the social circle, loving concerts, evening speakeasies, bustling community events, and dynamic group hangouts that stretch into the night.",
      traits: ["Extroverted", "Night Owl", "Live Events", "Social Magnet"],
    };
  }

  if (d1 <= 2 && d6 <= 2) {
    return {
      title: "Mindful Sanctuary",
      emoji: "☕",
      tagline: "Peaceful coffee chats, calm energy & unhurried friendship",
      summary: "You protect your social energy and prioritize quality over quantity. You love cozy corners, specialty coffee, peaceful walks, and friendships that require zero social pretense.",
      traits: ["Gentle Energy", "Thoughtful", "Low Pressure", "Cafe Enthusiast"],
    };
  }

  if (d2 >= 4 && d1 >= 3) {
    return {
      title: "Bon Vivant Foodie",
      emoji: "🍷",
      tagline: "Culinary curiosities, elevated dining & craft mixology",
      summary: "You connect deeply over extraordinary food, chef-driven kitchens, hidden cocktail bars, and memorable culinary discoveries. Dining out is your creative social canvas.",
      traits: ["Foodie", "Refined Taste", "Curated Spots", "Convivial Host"],
    };
  }

  if (d1 >= 4 && d6 >= 4) {
    return {
      title: "Dynamic Explorer",
      emoji: "⚡",
      tagline: "High momentum, team sports, hikes & group adventures",
      summary: "Always on the go and eager to rally people together. Whether it's weekend bouldering, beach volleyball, or city bike rides, you bring enthusiastic energy everywhere.",
      traits: ["High Energy", "Active Lifestyle", "Community Builder", "Upbeat"],
    };
  }

  if (d4 >= 4 && d9 >= 4) {
    return {
      title: "Grounded Pillar",
      emoji: "🤝",
      tagline: "Dependable, intentional planner & deeply loyal companion",
      summary: "You bring reliability, thoughtful planning, and rock-solid loyalty to your friendships. People count on you for genuine support, timely meetups, and unwavering character.",
      traits: ["Reliable", "Thoughtful Planner", "Loyal Friend", "Values First"],
    };
  }

  if (d5 >= 4 && d1 >= 3) {
    return {
      title: "Curious Conversationalist",
      emoji: "💡",
      tagline: "Witty banter, eclectic ideas & endless curiosity",
      summary: "You effortlessly blend playful wit with profound curiosity. You love exchanging book recommendations, discussing fresh ideas, and laughing over great stories with good company.",
      traits: ["Curious Mind", "Witty Banter", "Storyteller", "Open-Minded"],
    };
  }

  return {
    title: "Balanced Urbanite",
    emoji: "🎯",
    tagline: "Versatile, welcoming & tuned into great connection",
    summary: "You strike the golden balance: equally comfortable enjoying a low-key coffee catch-up or stepping out for a vibrant dinner. You adapt easily and appreciate diverse personalities.",
    traits: ["Adaptable", "Easygoing", "Harmonious", "Well-Rounded"],
  };
}

export function reconstructAnswersFromDimensions(dimensions: QuizDimensions): DetailedQuizAnswers {
  const d1 = dimensions.dimension_1_social || 3;
  const d2 = dimensions.dimension_2_budget || 3;
  const d3 = dimensions.dimension_3_spontaneity || 3;
  const d5 = dimensions.dimension_5_intellectual || 3;
  const d6 = dimensions.dimension_6_activity || 3;
  const d7 = dimensions.dimension_7_alcohol || 3;
  const d9 = dimensions.dimension_9_commitment || 3;

  const personalityChoice = d1 <= 2 ? "introverted" : d1 >= 4 ? "extroverted" : "ambivert";

  const scaleAnswers: Record<string, number> = {
    q1_personality_energy: d1,
    q4_family_importance: d9,
    q5_conversation_depth: Math.max(1, Math.min(5, 6 - d5)),
    q6_budget: d2,
    q7_activity_vs_sitting: d6,
    q8_spontaneity: d3,
    q9_drinking_nightlife: d7,
    q10_political_openness: d9,
  };

  const chipAnswers: Record<string, string[]> = {
    q2_free_time: ["tea_coffee", "music", "cooking_food"],
    q3_friend_qualities: ["authentic", "grounded", "funny"],
  };

  return {
    scaleAnswers,
    chipAnswers,
    personalityChoice,
  };
}

export function getSavedQuizAnswers(userId?: string | null): DetailedQuizAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    if (userId) {
      const savedUser = localStorage.getItem(`duogo_quiz_details_${userId}`);
      if (savedUser) return JSON.parse(savedUser);
    }
    const savedV2 = localStorage.getItem("duogo_quiz_progress_v2");
    if (savedV2) {
      const parsed = JSON.parse(savedV2);
      if (parsed.scaleAnswers && Object.keys(parsed.scaleAnswers).length > 0) {
        return {
          scaleAnswers: parsed.scaleAnswers,
          chipAnswers: parsed.chipAnswers || {},
          personalityChoice: parsed.personalityChoice,
        };
      }
    }
    const rawDraft = localStorage.getItem("duogo_signup_draft");
    if (rawDraft) {
      const draft = JSON.parse(rawDraft);
      if (draft.personality_energy || draft.free_time_interests || draft.quiz_answers) {
        return {
          scaleAnswers: {
            q4_family_importance: draft.family_importance || 3,
            ...(draft.quiz_answers || {}),
          },
          chipAnswers: {
            q2_free_time: draft.free_time_interests || [],
            q3_friend_qualities: draft.friend_qualities || [],
          },
          personalityChoice: draft.personality_energy,
        };
      }
    }
  } catch (e) {
    console.warn("Error getting saved quiz answers", e);
  }
  return null;
}

export function saveSavedQuizAnswers(userId: string, answers: DetailedQuizAnswers): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`duogo_quiz_details_${userId}`, JSON.stringify({
      ...answers,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn("Error saving quiz details", e);
  }
}

export async function saveUserQuizResponse(
  userId: string,
  coupleId: string | null,
  dimensions: QuizDimensions,
  detailedAnswers?: DetailedQuizAnswers
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Delete any previous rows for clean state
    await supabase.from("quiz_responses").delete().eq("user_id", userId);

    const payload = {
      user_id: userId,
      couple_id: coupleId || null,
      ...dimensions,
    };

    const { error: insertErr } = await supabase.from("quiz_responses").insert(payload as any);
    if (insertErr) {
      console.error("quiz_responses insert error:", insertErr);
      return { ok: false, error: insertErr.message };
    }

    await supabase
      .from("profiles")
      .update({ quiz_completed: true, onboarding_completed: true })
      .eq("id", userId);

    // Save dimensions locally for instant reference
    try {
      localStorage.setItem("duogo_quiz_dimensions", JSON.stringify(dimensions));
      if (detailedAnswers) {
        saveSavedQuizAnswers(userId, detailedAnswers);
      }
    } catch (e) {
      console.warn("Failed to cache dimensions locally", e);
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to save quiz" };
  }
}

export async function ensureUserQuizResponse(
  userId: string,
  coupleId?: string | null
): Promise<QuizDimensions> {
  try {
    const { data: existing } = await supabase
      .from("quiz_responses")
      .select("dimension_1_social, dimension_2_budget, dimension_3_spontaneity, dimension_4_planning, dimension_5_intellectual, dimension_6_activity, dimension_7_alcohol, dimension_8_humor, dimension_9_commitment, dimension_10_home")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.dimension_1_social !== null) {
      await supabase.from("profiles").update({ quiz_completed: true, onboarding_completed: true }).eq("id", userId);
      return existing as unknown as QuizDimensions;
    }

    // Auto-heal from local storage draft if available
    let dimensions: QuizDimensions;
    try {
      const rawDraft = localStorage.getItem("duogo_signup_draft");
      const draft = rawDraft ? JSON.parse(rawDraft) : null;
      if (draft?.quiz_answers && draft.quiz_answers.dimension_1_social) {
        dimensions = draft.quiz_answers as QuizDimensions;
      } else if (draft?.quiz_answers) {
        dimensions = compileQuizDimensions(
          draft.quiz_answers,
          { q3_friend_qualities: draft.friend_qualities || [] },
          draft.personality_energy
        );
      } else {
        dimensions = {
          dimension_1_social: 3,
          dimension_2_budget: 3,
          dimension_3_spontaneity: 3,
          dimension_4_planning: 3,
          dimension_5_intellectual: 3,
          dimension_6_activity: 3,
          dimension_7_alcohol: 3,
          dimension_8_humor: 3,
          dimension_9_commitment: 3,
          dimension_10_home: 3,
        };
      }
    } catch {
      dimensions = {
        dimension_1_social: 3,
        dimension_2_budget: 3,
        dimension_3_spontaneity: 3,
        dimension_4_planning: 3,
        dimension_5_intellectual: 3,
        dimension_6_activity: 3,
        dimension_7_alcohol: 3,
        dimension_8_humor: 3,
        dimension_9_commitment: 3,
        dimension_10_home: 3,
      };
    }

    await saveUserQuizResponse(userId, coupleId || null, dimensions);
    return dimensions;
  } catch (err) {
    console.warn("ensureUserQuizResponse warning:", err);
    return {
      dimension_1_social: 3,
      dimension_2_budget: 3,
      dimension_3_spontaneity: 3,
      dimension_4_planning: 3,
      dimension_5_intellectual: 3,
      dimension_6_activity: 3,
      dimension_7_alcohol: 3,
      dimension_8_humor: 3,
      dimension_9_commitment: 3,
      dimension_10_home: 3,
    };
  }
}

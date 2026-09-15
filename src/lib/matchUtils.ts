export const DIMENSION_LABELS = [
  "Social Energy",
  "Budget",
  "Spontaneity",
  "Planning",
  "Intellectual",
  "Activity",
  "Alcohol/Night",
  "Humor",
  "Commitment",
  "Home/Private",
];

export const DIMENSION_TAGS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "🎉", label: "Social Butterfly" },
  2: { emoji: "✨", label: "Upscale Tastes" },
  3: { emoji: "⚡", label: "Spontaneous Spirit" },
  4: { emoji: "📋", label: "Master Planner" },
  5: { emoji: "💬", label: "Deep Conversations" },
  6: { emoji: "🏃", label: "Active Adventurer" },
  7: { emoji: "🌙", label: "Night Owl" },
  8: { emoji: "😏", label: "Sharp Wit" },
  9: { emoji: "🤝", label: "Committed Friend" },
  10: { emoji: "🏠", label: "Home Hangouts" },
};

export const COMBO_TAGS: Record<string, string> = {
  "10,5": "Home Hangouts & Deep Talks",
  "1,7": "Nightlife Enthusiasts",
  "6,3": "Spontaneous Adventurers",
  "6,1": "Social & Active",
  "5,9": "Deep & Committed",
  "2,7": "Upscale Night Owls",
  "3,8": "Spontaneous Jokers",
  "4,9": "Structured & Committed",
  "10,9": "Homebodies for Life",
  "1,3": "Spontaneous Social Butterflies",
  "6,5": "Active Intellectuals",
  "2,4": "Polished Planners",
  "8,7": "Edgy Night Owls",
  "5,10": "Deep Homebodies",
};

export function getTopSharedVibes(
  myDims: number[],
  theirDims: number[]
): { emoji: string; label: string }[] {
  // Find dimensions where both score high (>=4) or are closest
  const shared = myDims.map((v, i) => ({
    dim: i + 1,
    avg: (v + theirDims[i]) / 2,
    diff: Math.abs(v - theirDims[i]),
  }));

  // Sort by highest average, then lowest diff
  shared.sort((a, b) => b.avg - a.avg || a.diff - b.diff);
  const top2 = shared.slice(0, 2);

  // Check for combo tag
  const comboKey = `${top2[0].dim},${top2[1].dim}`;
  const reverseKey = `${top2[1].dim},${top2[0].dim}`;
  const combo = COMBO_TAGS[comboKey] || COMBO_TAGS[reverseKey];

  if (combo) {
    return [
      { emoji: DIMENSION_TAGS[top2[0].dim].emoji, label: combo },
    ];
  }

  return top2.map(t => DIMENSION_TAGS[t.dim]);
}

export function getCandidateDisplayName(
  match: { user_type?: string; location_city?: string | null },
  vibes?: { label: string; emoji?: string }[]
): string {
  const topVibe = vibes && vibes.length > 0 ? vibes[0].label : null;
  const city = match.location_city ? match.location_city.split("·")[0].split("•")[0].trim() : null;
  const isCouple = match.user_type === "couple";

  if (topVibe && city) {
    return isCouple ? `${topVibe} Duo · ${city}` : `${topVibe} · ${city}`;
  }
  if (topVibe) {
    return isCouple ? `${topVibe} Duo` : `${topVibe} Member`;
  }
  if (city) {
    return isCouple ? `Duo Match · ${city}` : `Solo Match · ${city}`;
  }
  return isCouple ? "Duo Match" : "Solo Match";
}

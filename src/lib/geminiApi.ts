export interface MatchSynergyData {
  headline: string;
  summary: string;
  sharedStrengths: string[];
  recommendedActivity: string;
}

export interface FetchSynergyParams {
  userName?: string;
  matchName: string;
  sharedVibes?: string[];
  city?: string;
  score?: number;
  dimensionDetails?: string[];
}

export async function fetchMatchSynergy(params: FetchSynergyParams): Promise<MatchSynergyData> {
  try {
    const response = await fetch("/api/ai/synergy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Synergy request failed: ${response.statusText}`);
    }

    const json = await response.json();
    if (json?.data) {
      return json.data;
    }
  } catch (err) {
    console.warn("Could not fetch AI synergy breakdown from server:", err);
  }

  // Fallback if network fails
  const topVibe = params.sharedVibes?.[0] || "Shared Lifestyle";
  const cleanCity = params.city ? params.city.split("·")[0].split("•")[0].trim() : "";
  return {
    headline: `${topVibe} Harmony`,
    summary: `Your profiles show a strong ${params.score || 85}% compatibility across lifestyle rhythms and social battery preferences.`,
    sharedStrengths: [
      `Compatible rhythm for ${topVibe.toLowerCase()}`,
      "Aligned preferences for social get-togethers",
      "Complementary weekend schedules",
    ],
    recommendedActivity: cleanCity
      ? `Casual coffee or neighborhood walk in ${cleanCity}`
      : "Meet for a casual coffee or tea walk",
  };
}

export interface FetchIcebreakersParams {
  userName?: string;
  matchName: string;
  sharedVibes?: string[];
  city?: string;
  userType?: string;
}

export async function fetchMatchIcebreakers(params: FetchIcebreakersParams): Promise<string[]> {
  try {
    const response = await fetch("/api/ai/icebreakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Icebreakers request failed: ${response.statusText}`);
    }

    const json = await response.json();
    if (Array.isArray(json?.icebreakers) && json.icebreakers.length > 0) {
      return json.icebreakers;
    }
  } catch (err) {
    console.warn("Could not fetch AI icebreakers from server:", err);
  }

  // Client-side fallback if server fails
  const vibe = params.sharedVibes?.[0] || "shared weekend habits";
  return [
    `Hey ${params.matchName}! Looks like we clicked on ${vibe}. What's your go-to weekend spot around here?`,
    `Hi ${params.matchName}! Love that our vibes match. Are you more of a morning coffee explorer or evening hangout fan?`,
    `Hey! What's something fun or interesting that happened in your week so far?`,
  ];
}

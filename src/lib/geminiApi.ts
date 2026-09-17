import { supabase } from "@/integrations/supabase/client";

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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch("/api/ai/synergy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

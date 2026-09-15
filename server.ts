import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * Endpoint 1: Match Synergy Summary ("Why You Two Click")
 * Generates an intelligent, personalized breakdown of compatibility
 */
app.post("/api/ai/synergy", async (req, res) => {
  try {
    const {
      userName = "You",
      matchName = "Your match",
      sharedVibes = [],
      city = "",
      score = 85,
      dimensionDetails = [],
    } = req.body;

    const ai = getAIClient();

    if (ai) {
      const prompt = `You are the lead friendship compatibility expert at 'duogo', an intentional adult friendship app.
Analyze the mutual compatibility between two people based purely on their quiz responses and lifestyle traits:
- User 1: You
- User 2: Candidate Match
- Compatibility Match Score: ${score}%
${city ? `- Location: ${city}` : ""}
${sharedVibes.length > 0 ? `- Top Shared Lifestyle Vibes: ${sharedVibes.join(", ")}` : ""}
${dimensionDetails.length > 0 ? `- Shared Traits / Dimensions: ${dimensionDetails.join(", ")}` : ""}

CRITICAL RULES:
- STRICT ZERO-BIAS & GENDER-NEUTRAL: Never use names, gender, or gendered pronouns (no he/she/his/her). Always use gender-neutral phrasing (e.g., "you and your match", "both of you").
- Focus 100% on shared lifestyle pacing, social battery, gathering preferences, and weekend rhythms from their quiz responses.

Generate an insightful, uplifting, and realistic "Why You Two Click" breakdown:
1. 'headline': A punchy 3 to 6 word theme summarizing their shared vibe (e.g. "Weekend Explorers & Deep Thinkers").
2. 'summary': 2 warm, natural sentences explaining why their lifestyles and energy complement each other so well without mentioning names or genders.
3. 'sharedStrengths': An array of 3 distinct, specific synergies (e.g. "Both favor relaxed coffee spots over high-volume venues", "Balanced blend of intellectual banter and outdoor curiosity").
4. 'recommendedActivity': A specific, low-pressure first hangout idea tailored to their common interests.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                summary: { type: Type.STRING },
                sharedStrengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedActivity: { type: Type.STRING },
              },
              required: ["headline", "summary", "sharedStrengths", "recommendedActivity"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, source: "gemini", data: parsed });
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed, falling back to algorithmic synthesis:", geminiErr);
      }
    }

    // Algorithmic Fallback if Gemini key is missing or call encounters limit
    const fallbackVibes = sharedVibes.length > 0 ? sharedVibes : ["Social Rhythm", "Weekend Pacing", "Shared Interests"];
    const topVibe = fallbackVibes[0] || "Lifestyle Alignment";
    const secondVibe = fallbackVibes[1] || "Social Battery";
    const cleanCity = city ? city.split("·")[0].split("•")[0].trim() : "";

    return res.json({
      success: true,
      source: "algorithmic_fallback",
      data: {
        headline: `${topVibe} & ${secondVibe}`,
        summary: `Your quiz results show a strong ${score}% synergy. You both share a synchronized social pace and complementary routines for low-pressure get-togethers.`,
        sharedStrengths: [
          `Compatible tempo for ${topVibe.toLowerCase()}`,
          `Complementary social energy for relaxed hangouts`,
          `Similar balance between active socializing and quiet downtime`,
        ],
        recommendedActivity: cleanCity
          ? `Casual coffee or neighborhood stroll in ${cleanCity}`
          : "Grab a coffee or tea and take a relaxed neighborhood walk",
      },
    });
  } catch (error) {
    console.error("Error generating synergy summary:", error);
    res.status(500).json({ error: "Failed to generate synergy breakdown" });
  }
});

/**
 * Endpoint 2: AI Conversation Starters
 * Generates personalized, engaging icebreakers to kickstart in-app chat
 */
app.post("/api/ai/icebreakers", async (req, res) => {
  try {
    const {
      userName = "User",
      matchName = "Friend",
      sharedVibes = [],
      city = "",
      userType = "solo",
    } = req.body;

    const ai = getAIClient();

    if (ai) {
      const prompt = `You are a social conversational coach for 'duogo', an intentional adult friendship platform.
Create 4 natural, engaging, and friendly conversation starters for ${userName} to send to their new match ${matchName}.
${city ? `- City/Region: ${city}` : ""}
${userType === "couple" ? "- Note: One or both parties are a couple seeking couple/double-date friendships." : ""}
${sharedVibes.length > 0 ? `- Shared Vibes / Interests: ${sharedVibes.join(", ")}` : ""}

Rules for the icebreakers:
- Keep them casual, witty, and relatable — NO cheesy pickup lines, NO awkward interview questions.
- Reference their shared vibe or common activities naturally.
- Keep each starter to 1-2 punchy sentences that make it effortless to reply.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                icebreakers: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["icebreakers"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, source: "gemini", icebreakers: parsed.icebreakers || [] });
        }
      } catch (geminiErr) {
        console.warn("Gemini icebreaker generation failed, falling back:", geminiErr);
      }
    }

    // High quality fallback icebreakers
    const fallbackStarters = [
      `Hey ${matchName}! Looks like our vibes matched on ${sharedVibes[0] || "lifestyle habits"}. What's your go-to weekend spot around here?`,
      `Hi ${matchName}! Love that we're both into ${sharedVibes[1] || "good food and relaxed hangouts"}. Any recent cafe or hidden gem you'd recommend?`,
      `Hey! Excited we matched. Quick question: are you more of an early morning coffee person or a late evening chill person?`,
      `Hey ${matchName}, great to connect! What's currently the highlight of your week?`,
    ];

    return res.json({
      success: true,
      source: "algorithmic_fallback",
      icebreakers: fallbackStarters,
    });
  } catch (error) {
    console.error("Error generating icebreakers:", error);
    res.status(500).json({ error: "Failed to generate conversation starters" });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Duogo server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import { ALL_DIMS, ANCHOR_DIMS } from "@/lib/scoring";
import { DIMENSION_LABELS, DIMENSION_TAGS } from "@/lib/matchUtils";

export interface DimensionBreakdownItem {
  id: number;
  label: string;
  myScore: number;
  theirScore: number;
  diff: number;
  matchPct: number;
  isAnchor: boolean;
  emoji: string;
}

export interface CategoryScore {
  name: string;
  pct: number;
  description: string;
}

export interface QuizCompatibilityResult {
  overallScore: number;
  breakdown: DimensionBreakdownItem[];
  categories: CategoryScore[];
  topSynergies: DimensionBreakdownItem[];
}

/**
 * Calculates authentic weighted Euclidean compatibility score from quiz response arrays
 */
export function calculateQuizCompatibility(
  myDims?: number[],
  theirDims?: number[],
  fallbackScore = 82
): QuizCompatibilityResult {
  // If either set of dimensions is missing, construct reasonable fallback from fallbackScore
  if (!myDims || !theirDims || myDims.length < 10 || theirDims.length < 10) {
    const score = Math.max(50, Math.min(99, Math.round(fallbackScore)));
    return {
      overallScore: score,
      breakdown: [],
      categories: [
        {
          name: "Anchor Values",
          pct: Math.min(100, score + 2),
          description: "Core lifestyle, home & commitment priorities (2x weight)",
        },
        {
          name: "Social Battery",
          pct: Math.max(50, score - 3),
          description: "Energy levels, spontaneity & weekend outing pace",
        },
        {
          name: "Mindset & Rhythm",
          pct: Math.min(100, score + 1),
          description: "Intellectual banter, planning & shared humor",
        },
      ],
      topSynergies: [],
    };
  }

  // Calculate dimension-by-dimension differences
  let totalWeightedDiffSq = 0;
  const breakdown: DimensionBreakdownItem[] = [];

  for (let i = 0; i < 10; i++) {
    const dimId = i + 1;
    const isAnchor = ANCHOR_DIMS.includes(dimId);
    const weight = isAnchor ? 2 : 1;
    const myVal = Math.max(1, Math.min(5, myDims[i] ?? 3));
    const theirVal = Math.max(1, Math.min(5, theirDims[i] ?? 3));
    const diff = Math.abs(myVal - theirVal);

    totalWeightedDiffSq += weight * diff * diff;

    // Dimensional alignment percentage (diff=0 is 100%, diff=1 is 75%, diff=2 is 50%, diff=3 is 25%, diff=4 is 0%)
    const matchPct = Math.round(Math.max(0, 100 - (diff / 4) * 100));

    breakdown.push({
      id: dimId,
      label: DIMENSION_LABELS[i] || `Dimension ${dimId}`,
      myScore: myVal,
      theirScore: theirVal,
      diff,
      matchPct,
      isAnchor,
      emoji: DIMENSION_TAGS[dimId]?.emoji || "✨",
    });
  }

  // Max distance formula: 4 anchor dims with weight 2, 6 standard dims with weight 1, max diff is 4
  // 4 * (2 * 16) + 6 * (1 * 16) = 128 + 96 = 224
  const maxDistance = Math.sqrt(224);
  const calculatedDist = Math.sqrt(totalWeightedDiffSq);
  const rawScore = 100 - (calculatedDist / maxDistance) * 100;
  const overallScore = Math.max(50, Math.min(99, Math.round(rawScore * 10) / 10));

  // Category aggregations
  // 1. Anchor Values: Dims 2, 7, 9, 10 (Max sum: 4 * 16 = 64)
  const anchorDims = [2, 7, 9, 10];
  let anchorSq = 0;
  anchorDims.forEach((d) => {
    const item = breakdown.find((b) => b.id === d);
    if (item) anchorSq += item.diff * item.diff;
  });
  const anchorPct = Math.round(Math.max(0, 100 - (Math.sqrt(anchorSq) / Math.sqrt(64)) * 100));

  // 2. Social Battery: Dims 1, 3, 6 (Social Energy, Spontaneity, Activity - Max sum: 3 * 16 = 48)
  const socialDims = [1, 3, 6];
  let socialSq = 0;
  socialDims.forEach((d) => {
    const item = breakdown.find((b) => b.id === d);
    if (item) socialSq += item.diff * item.diff;
  });
  const socialPct = Math.round(Math.max(0, 100 - (Math.sqrt(socialSq) / Math.sqrt(48)) * 100));

  // 3. Mindset & Rhythm: Dims 4, 5, 8 (Planning, Intellectual Depth, Humor - Max sum: 3 * 16 = 48)
  const mindsetDims = [4, 5, 8];
  let mindsetSq = 0;
  mindsetDims.forEach((d) => {
    const item = breakdown.find((b) => b.id === d);
    if (item) mindsetSq += item.diff * item.diff;
  });
  const mindsetPct = Math.round(Math.max(0, 100 - (Math.sqrt(mindsetSq) / Math.sqrt(48)) * 100));

  const categories: CategoryScore[] = [
    {
      name: "Anchor Values",
      pct: anchorPct,
      description: "Budget, nightlife, commitment & home habits (2x weight)",
    },
    {
      name: "Social Battery",
      pct: socialPct,
      description: "Energy levels, spontaneity & physical activity pace",
    },
    {
      name: "Mindset & Rhythm",
      pct: mindsetPct,
      description: "Intellectual depth, planning style & humor wavelength",
    },
  ];

  // Top synergies (sorted by highest matchPct, then anchor priority)
  const topSynergies = [...breakdown]
    .sort((a, b) => b.matchPct - a.matchPct || (b.isAnchor ? 1 : 0) - (a.isAnchor ? 1 : 0))
    .slice(0, 3);

  return {
    overallScore,
    breakdown,
    categories,
    topSynergies,
  };
}

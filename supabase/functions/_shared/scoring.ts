// Shared compatibility scoring used by calculate-matches, weekly-match-digest
// and notify-new-matches. Keep this the single source of truth.

export const ANCHOR_DIMS = [2, 7, 9, 10]; // 2x weight
export const ALL_DIMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const SOLO_THRESHOLD = 65;
export const COUPLE_THRESHOLD = 60;

export const DIM_NAMES = [
  "social",
  "budget",
  "spontaneity",
  "planning",
  "intellectual",
  "activity",
  "alcohol",
  "humor",
  "commitment",
  "home",
];

export interface QuizRow {
  user_id: string;
  couple_id?: string | null;
  [key: string]: any;
}

export function getDim(row: QuizRow, d: number): number {
  return row[`dimension_${d}_${DIM_NAMES[d - 1]}`] as number;
}

export function soloDistance(a: QuizRow, b: QuizRow): number {
  let sum = 0;
  for (const d of ALL_DIMS) {
    const diff = getDim(a, d) - getDim(b, d);
    const weight = ANCHOR_DIMS.includes(d) ? 2 : 1;
    sum += weight * diff * diff;
  }
  return Math.sqrt(sum);
}

export function soloScore(a: QuizRow, b: QuizRow): number {
  // Max possible weighted distance: sqrt(14 * 4^2) = sqrt(224)
  const maxDist = Math.sqrt(224);
  const score = 100 - (soloDistance(a, b) / maxDist) * 100;
  return Math.round(score * 10) / 10;
}

export interface CoupleVector {
  couple_id: string;
  mins: number[];
  maxs: number[];
}

export function buildCoupleVector(a: QuizRow, b: QuizRow): CoupleVector {
  const mins: number[] = [];
  const maxs: number[] = [];
  for (const d of ALL_DIMS) {
    const va = getDim(a, d);
    const vb = getDim(b, d);
    mins.push(Math.min(va, vb));
    maxs.push(Math.max(va, vb));
  }
  return { couple_id: (a.couple_id as string) ?? "", mins, maxs };
}

export function coupleOverlapScore(a: CoupleVector, b: CoupleVector): number {
  let anchorScore = 0;
  let flexScore = 0;
  let anchorCount = 0;
  let flexCount = 0;

  for (let i = 0; i < ALL_DIMS.length; i++) {
    const d = ALL_DIMS[i];
    const isAnchor = ANCHOR_DIMS.includes(d);
    const tolerance = isAnchor ? 1 : 2;

    const overlapMin = Math.max(a.mins[i], b.mins[i]);
    const overlapMax = Math.min(a.maxs[i], b.maxs[i]);
    const gap = overlapMin - overlapMax;

    let dimScore: number;
    if (gap <= 0) {
      dimScore = 1;
    } else if (gap <= tolerance) {
      dimScore = 1 - gap / (tolerance + 1);
    } else {
      dimScore = 0;
    }

    if (isAnchor) {
      anchorScore += dimScore;
      anchorCount++;
    } else {
      flexScore += dimScore;
      flexCount++;
    }
  }

  const normalizedAnchor = anchorCount > 0 ? anchorScore / anchorCount : 0;
  const normalizedFlex = flexCount > 0 ? flexScore / flexCount : 0;
  return Math.round((normalizedAnchor * 0.7 + normalizedFlex * 0.3) * 100 * 10) / 10;
}

// Row -> CoupleVector helper for the couple_vectors table shape.
export function vectorFromRow(row: any): CoupleVector {
  return {
    couple_id: row.couple_id,
    mins: ALL_DIMS.map((d) => row[`d${d}_min`]),
    maxs: ALL_DIMS.map((d) => row[`d${d}_max`]),
  };
}

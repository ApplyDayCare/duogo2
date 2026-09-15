// Client-side compatibility scoring matching backend algorithm

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
  user_id?: string;
  couple_id?: string | null;
  dimension_1_social?: number;
  dimension_2_budget?: number;
  dimension_3_spontaneity?: number;
  dimension_4_planning?: number;
  dimension_5_intellectual?: number;
  dimension_6_activity?: number;
  dimension_7_alcohol?: number;
  dimension_8_humor?: number;
  dimension_9_commitment?: number;
  dimension_10_home?: number;
  [key: string]: any;
}

export function getDim(row: QuizRow, d: number): number {
  const name = `dimension_${d}_${DIM_NAMES[d - 1]}`;
  return (row[name] as number) ?? (row[`dimension_${d}`] as number) ?? 3;
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
  const maxDist = Math.sqrt(224);
  const score = 100 - (soloDistance(a, b) / maxDist) * 100;
  return Math.round(score * 10) / 10;
}

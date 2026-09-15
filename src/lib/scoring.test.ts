import { describe, it, expect } from "vitest";
import { soloScore, soloDistance, ANCHOR_DIMS, ALL_DIMS, QuizRow } from "./scoring";
import { compileQuizDimensions } from "./quizSync";
import { calculateDistanceKm, isWithin5Km } from "./postalCodeUtils";
import { getTopSharedVibes } from "./matchUtils";

describe("Compatibility Scoring Engine", () => {
  it("computes a perfect 100% score for identical quiz responses", () => {
    const userA: QuizRow = {
      dimension_1_social: 4,
      dimension_2_budget: 3,
      dimension_3_spontaneity: 5,
      dimension_4_planning: 1,
      dimension_5_intellectual: 4,
      dimension_6_activity: 3,
      dimension_7_alcohol: 2,
      dimension_8_humor: 4,
      dimension_9_commitment: 5,
      dimension_10_home: 4,
    };
    const userB: QuizRow = { ...userA };

    const distance = soloDistance(userA, userB);
    expect(distance).toBe(0);

    const score = soloScore(userA, userB);
    expect(score).toBe(100);
  });

  it("applies 2x weight to anchor dimensions", () => {
    // Difference of 1 in a non-anchor dimension (e.g. dim 1: social)
    const base: QuizRow = {
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

    const diffNonAnchor: QuizRow = {
      ...base,
      dimension_1_social: 4, // 1 diff -> weight 1 -> 1^2 * 1 = 1
    };

    const diffAnchor: QuizRow = {
      ...base,
      dimension_2_budget: 4, // 1 diff -> weight 2 (anchor) -> 1^2 * 2 = 2
    };

    const distNonAnchor = soloDistance(base, diffNonAnchor);
    const distAnchor = soloDistance(base, diffAnchor);

    expect(distNonAnchor).toBe(1); // sqrt(1)
    expect(distAnchor).toBeCloseTo(Math.sqrt(2), 5);

    expect(soloScore(base, diffAnchor)).toBeLessThan(soloScore(base, diffNonAnchor));
  });

  it("produces valid scores between 0 and 100 even in maximum divergence", () => {
    const maxLow: QuizRow = {
      dimension_1_social: 1,
      dimension_2_budget: 1,
      dimension_3_spontaneity: 1,
      dimension_4_planning: 1,
      dimension_5_intellectual: 1,
      dimension_6_activity: 1,
      dimension_7_alcohol: 1,
      dimension_8_humor: 1,
      dimension_9_commitment: 1,
      dimension_10_home: 1,
    };

    const maxHigh: QuizRow = {
      dimension_1_social: 5,
      dimension_2_budget: 5,
      dimension_3_spontaneity: 5,
      dimension_4_planning: 5,
      dimension_5_intellectual: 5,
      dimension_6_activity: 5,
      dimension_7_alcohol: 5,
      dimension_8_humor: 5,
      dimension_9_commitment: 5,
      dimension_10_home: 5,
    };

    const score = soloScore(maxLow, maxHigh);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("Quiz Compilation & Normalization", () => {
  it("correctly maps personality energy choices to dimension 1", () => {
    const introverted = compileQuizDimensions({}, {}, "introverted");
    expect(introverted.dimension_1_social).toBe(1);

    const ambivert = compileQuizDimensions({}, {}, "ambivert");
    expect(ambivert.dimension_1_social).toBe(3);

    const extroverted = compileQuizDimensions({}, {}, "extroverted");
    expect(extroverted.dimension_1_social).toBe(5);
  });

  it("correctly inverts spontaneity to planning and alcohol to home", () => {
    const res = compileQuizDimensions({
      q8_spontaneity: 5,
      q9_drinking_nightlife: 4,
    });

    // Planning should be 6 - 5 = 1
    expect(res.dimension_4_planning).toBe(1);
    // Home should be 6 - 4 = 2
    expect(res.dimension_10_home).toBe(2);
  });

  it("handles empty scale inputs gracefully with sensible defaults", () => {
    const res = compileQuizDimensions({}, {});
    expect(res.dimension_1_social).toBe(3);
    expect(res.dimension_2_budget).toBe(3);
    expect(res.dimension_3_spontaneity).toBe(3);
    expect(res.dimension_4_planning).toBe(3);
    expect(res.dimension_10_home).toBe(3);
  });
});

describe("Location & Distance Intelligence", () => {
  it("treats identical FSAs as within 5km (~1.2km)", () => {
    const dist = calculateDistanceKm("M5V 2T6", "M5V 3B1");
    expect(dist).toBe(1.2);
    expect(isWithin5Km("M5V 2T6", "M5V 3B1")).toBe(true);
  });

  it("accurately detects proximity between adjacent Downtown Toronto FSAs", () => {
    // M5V (King West / Entertainment) to M5H (Financial District)
    const dist = calculateDistanceKm("M5V", "M5H");
    expect(dist).not.toBeNull();
    if (dist !== null) {
      expect(dist).toBeLessThan(5);
      expect(isWithin5Km("M5V", "M5H")).toBe(true);
    }
  });

  it("returns false for distant locations (e.g. Toronto to Ottawa)", () => {
    const dist = calculateDistanceKm("M5V 2T6", "K1P 1J1");
    expect(dist).not.toBeNull();
    if (dist !== null) {
      expect(dist).toBeGreaterThan(50);
      expect(isWithin5Km("M5V 2T6", "K1P 1J1")).toBe(false);
    }
  });
});

describe("Shared Vibes Generation", () => {
  it("identifies high-scoring shared traits between matched profiles", () => {
    const myDims = [5, 4, 5, 2, 4, 3, 5, 4, 4, 2];
    const theirDims = [5, 3, 5, 2, 4, 3, 4, 4, 4, 2];

    const vibes = getTopSharedVibes(myDims, theirDims);
    expect(vibes.length).toBeGreaterThan(0);
    expect(vibes[0]).toHaveProperty("emoji");
    expect(vibes[0]).toHaveProperty("label");
  });
});

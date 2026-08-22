/**
 * knowledge-tracing.test.ts
 *
 * Unit tests for the pure BKT knowledge-tracing module.
 * No mocks needed — all functions are deterministic and side-effect-free
 * (except selectNextConcept which uses Math.random; we test both branches explicitly).
 */

import { describe, it, expect } from 'vitest';
import {
  updateMastery,
  masteryDelta,
  selectNextConcept,
  masteryToDifficulty,
  shouldTriggerSpacedRepetition,
  overallMastery,
  getWeakConcepts,
  getStrongConcepts,
  initConceptMastery,
  applyAnswer,
  MASTERY_THRESHOLD,
} from '../knowledge-tracing.js';
import type { MasteryMap } from '../../../shared/types.js';

// ---- helpers -----------------------------------------------

function makeMap(entries: Record<string, number>): MasteryMap {
  return Object.fromEntries(
    Object.entries(entries).map(([concept, score]) => [
      concept,
      {
        concept,
        score,
        attempts: 5,
        correctAttempts: 3,
        lastUpdated: new Date().toISOString(),
        trend: [score],
      },
    ])
  );
}

// ---- updateMastery -----------------------------------------

describe('updateMastery', () => {
  it('increases mastery on a correct answer (medium difficulty)', () => {
    const before = 0.5;
    const after = updateMastery(before, true, 'medium');
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(1);
  });

  it('decreases mastery on an incorrect answer (medium difficulty)', () => {
    const before = 0.5;
    const after = updateMastery(before, false, 'medium');
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it('increases mastery on correct answer for easy difficulty', () => {
    const before = 0.3;
    const after = updateMastery(before, true, 'easy');
    expect(after).toBeGreaterThan(before);
  });

  it('decreases mastery on incorrect answer for hard difficulty', () => {
    const before = 0.7;
    const after = updateMastery(before, false, 'hard');
    expect(after).toBeLessThan(before);
  });

  it('clamps mastery near 0 — never goes below 0', () => {
    // At mastery=0, a wrong answer should still return >= 0
    const after = updateMastery(0, false, 'hard');
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it('clamps mastery near 1 — never goes above 1', () => {
    // At mastery=1, a correct answer should still return <= 1
    const after = updateMastery(1, true, 'easy');
    expect(after).toBeLessThanOrEqual(1);
  });

  it('always applies learning gain — correct answer at mastery=0 still increases', () => {
    const after = updateMastery(0, true, 'medium');
    expect(after).toBeGreaterThan(0);
  });

  it('applies learning gain even after wrong answer — mastery at 0 increases slightly due to P_learn', () => {
    // At mastery=0, BKT Bayesian update of a wrong answer stays near 0 (since P_knows was 0).
    // But P_learn=0.10 adds 0.10*(1-P_knows_after) ≈ 0.10 learning gain.
    // So the score after a wrong answer from 0 is approximately P_learn.
    const after = updateMastery(0, false, 'medium');
    // Score should be positive due to learning gain
    expect(after).toBeGreaterThan(0);
    // But should be small (< 0.15 — just the learning gain)
    expect(after).toBeLessThan(0.15);
  });

  it('correct answer at high mastery keeps mastery high', () => {
    const after = updateMastery(0.95, true, 'medium');
    expect(after).toBeGreaterThanOrEqual(0.9);
  });

  it('multiple correct answers monotonically increase mastery from low start', () => {
    let mastery = 0.1;
    const scores: number[] = [mastery];
    for (let i = 0; i < 10; i++) {
      mastery = updateMastery(mastery, true, 'medium');
      scores.push(mastery);
    }
    // Each score should be >= previous (monotonically non-decreasing with all-correct)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });

  it('accepts custom BKT parameters', () => {
    // Higher P_learn means more learning gain, so aggressive P_learn should yield higher result
    const conservativeLearn = updateMastery(0.5, true, 'medium', {
      pLearn: 0.01,
      pGuess: 0.2,
      pSlip: 0.1,
    });
    const aggressiveLearn = updateMastery(0.5, true, 'medium', {
      pLearn: 0.5,
      pGuess: 0.2,
      pSlip: 0.1,
    });
    // Higher P_learn → more transition from unknown to known → higher final score
    expect(aggressiveLearn).toBeGreaterThan(conservativeLearn);
    // Both should be higher than starting mastery (0.5)
    expect(conservativeLearn).toBeGreaterThan(0.5);
    expect(aggressiveLearn).toBeGreaterThan(0.5);
  });

  it('output is always a finite number', () => {
    const values = [0, 0.001, 0.5, 0.999, 1];
    for (const v of values) {
      expect(isFinite(updateMastery(v, true))).toBe(true);
      expect(isFinite(updateMastery(v, false))).toBe(true);
    }
  });
});

// ---- masteryDelta ------------------------------------------

describe('masteryDelta', () => {
  it('returns positive delta when new > old', () => {
    expect(masteryDelta(0.3, 0.5)).toBeCloseTo(0.2, 3);
  });

  it('returns negative delta when new < old', () => {
    expect(masteryDelta(0.7, 0.5)).toBeCloseTo(-0.2, 3);
  });

  it('returns 0 for equal scores', () => {
    expect(masteryDelta(0.5, 0.5)).toBe(0);
  });
});

// ---- masteryToDifficulty -----------------------------------

describe('masteryToDifficulty', () => {
  it('returns easy for mastery < 0.3', () => {
    expect(masteryToDifficulty(0)).toBe('easy');
    expect(masteryToDifficulty(0.1)).toBe('easy');
    expect(masteryToDifficulty(0.29)).toBe('easy');
  });

  it('returns medium for mastery 0.3–0.59', () => {
    expect(masteryToDifficulty(0.3)).toBe('medium');
    expect(masteryToDifficulty(0.5)).toBe('medium');
    expect(masteryToDifficulty(0.599)).toBe('medium');
  });

  it('returns hard for mastery >= 0.6', () => {
    expect(masteryToDifficulty(0.6)).toBe('hard');
    expect(masteryToDifficulty(0.8)).toBe('hard');
    expect(masteryToDifficulty(1)).toBe('hard');
  });
});

// ---- selectNextConcept -------------------------------------

describe('selectNextConcept', () => {
  it('returns a default when mastery map is empty', () => {
    const result = selectNextConcept({});
    expect(result.concept).toBe('general');
    expect(result.difficulty).toBe('medium');
    expect(result.rationale).toBeTruthy();
  });

  it('selects the weakest concept when multiple are available', () => {
    const map = makeMap({ variables: 0.2, loops: 0.5, functions: 0.8 });
    // forceInterleave=false ensures we pick from weak pool
    const result = selectNextConcept(map, 0, false);
    expect(result.concept).toBe('variables'); // lowest mastery
    expect(result.rationale).toContain('variables');
  });

  it('assigns easy difficulty for low-mastery concept', () => {
    const map = makeMap({ variables: 0.1 });
    const result = selectNextConcept(map, 0, false);
    expect(result.difficulty).toBe('easy');
  });

  it('assigns medium difficulty for mid-mastery concept', () => {
    const map = makeMap({ variables: 0.45 });
    const result = selectNextConcept(map, 0, false);
    expect(result.difficulty).toBe('medium');
  });

  it('assigns hard difficulty for high-mastery concept', () => {
    const map = makeMap({ variables: 0.75 });
    // No weak concepts → picks from strong pool
    const result = selectNextConcept(map, 0, false);
    expect(result.difficulty).toBe('hard');
  });

  it('returns a rationale string', () => {
    const map = makeMap({ loops: 0.3 });
    const result = selectNextConcept(map, 0, false);
    expect(typeof result.rationale).toBe('string');
    expect(result.rationale.length).toBeGreaterThan(10);
  });

  it('uses spaced repetition (forceInterleave=true) — picks from strong concepts', () => {
    const map = makeMap({
      variables: 0.1, // weak
      loops: 0.9,     // strong
    });
    const result = selectNextConcept(map, 0, true); // force interleave
    expect(result.concept).toBe('loops'); // only strong concept available
    expect(result.rationale).toContain('spaced-repetition');
  });

  it('ignores spaced repetition if no strong concepts exist', () => {
    const map = makeMap({ variables: 0.2, loops: 0.3 }); // all weak
    const result = selectNextConcept(map, 1, false); // interleave=1 but no strong concepts
    // Should fall through to weakest concept
    expect(['variables', 'loops']).toContain(result.concept);
  });

  it('all-mastered: picks lowest strong concept', () => {
    const map = makeMap({ a: 0.75, b: 0.85, c: 0.95 });
    const result = selectNextConcept(map, 0, false); // no interleave
    expect(result.concept).toBe('a'); // lowest of all strong
  });
});

// ---- shouldTriggerSpacedRepetition -------------------------

describe('shouldTriggerSpacedRepetition', () => {
  it('returns false for empty map', () => {
    expect(shouldTriggerSpacedRepetition({})).toBe(false);
  });

  it('returns false when no concepts are mastered', () => {
    const map = makeMap({ a: 0.1, b: 0.2 });
    expect(shouldTriggerSpacedRepetition(map)).toBe(false);
  });

  it('returns true when >= 30% of concepts are mastered', () => {
    const map = makeMap({ a: 0.8, b: 0.9, c: 0.1 }); // 2/3 mastered = 66%
    expect(shouldTriggerSpacedRepetition(map)).toBe(true);
  });

  it('returns false when < 30% are mastered', () => {
    const map = makeMap({ a: 0.8, b: 0.1, c: 0.1, d: 0.1 }); // 1/4 = 25%
    expect(shouldTriggerSpacedRepetition(map)).toBe(false);
  });
});

// ---- overallMastery ----------------------------------------

describe('overallMastery', () => {
  it('returns 0 for empty map', () => {
    expect(overallMastery({})).toBe(0);
  });

  it('returns correct mean for single concept', () => {
    const map = makeMap({ a: 0.6 });
    expect(overallMastery(map)).toBeCloseTo(0.6, 3);
  });

  it('returns correct mean for multiple concepts', () => {
    const map = makeMap({ a: 0.2, b: 0.4, c: 0.6 });
    expect(overallMastery(map)).toBeCloseTo(0.4, 2);
  });
});

// ---- getWeakConcepts / getStrongConcepts -------------------

describe('getWeakConcepts', () => {
  it('returns concepts below threshold sorted by mastery ascending', () => {
    const map = makeMap({ a: 0.2, b: 0.5, c: 0.8 });
    const weak = getWeakConcepts(map);
    expect(weak).toEqual(['a', 'b']);
  });

  it('returns empty array when all are mastered', () => {
    const map = makeMap({ a: 0.8, b: 0.9 });
    expect(getWeakConcepts(map)).toEqual([]);
  });
});

describe('getStrongConcepts', () => {
  it('returns concepts at or above threshold', () => {
    const map = makeMap({ a: 0.2, b: 0.7, c: 0.9 });
    const strong = getStrongConcepts(map);
    expect(strong).toContain('b');
    expect(strong).toContain('c');
    expect(strong).not.toContain('a');
  });
});

// ---- initConceptMastery ------------------------------------

describe('initConceptMastery', () => {
  it('creates a concept with default initial score 0.1', () => {
    const m = initConceptMastery('variables');
    expect(m.concept).toBe('variables');
    expect(m.score).toBeCloseTo(0.1, 5);
    expect(m.attempts).toBe(0);
    expect(m.trend).toEqual([0.1]);
  });

  it('accepts custom initial score', () => {
    const m = initConceptMastery('loops', 0.5);
    expect(m.score).toBeCloseTo(0.5, 5);
  });

  it('clamps initial score to [0, 1]', () => {
    expect(initConceptMastery('x', -0.5).score).toBe(0);
    expect(initConceptMastery('x', 1.5).score).toBe(1);
  });
});

// ---- applyAnswer -------------------------------------------

describe('applyAnswer', () => {
  it('increments attempts and correctAttempts on correct answer', () => {
    const mastery = initConceptMastery('loops', 0.4);
    const updated = applyAnswer(mastery, true, 'medium');
    expect(updated.attempts).toBe(1);
    expect(updated.correctAttempts).toBe(1);
  });

  it('increments attempts but not correctAttempts on wrong answer', () => {
    const mastery = initConceptMastery('loops', 0.4);
    const updated = applyAnswer(mastery, false, 'medium');
    expect(updated.attempts).toBe(1);
    expect(updated.correctAttempts).toBe(0);
  });

  it('updates trend array with new score', () => {
    const mastery = initConceptMastery('loops', 0.4);
    const updated = applyAnswer(mastery, true, 'medium');
    expect(updated.trend.length).toBe(2);
    expect(updated.trend[1]).toBeGreaterThan(0.4);
  });

  it('caps trend array at 20 entries', () => {
    let mastery = initConceptMastery('loops', 0.4);
    for (let i = 0; i < 25; i++) {
      mastery = applyAnswer(mastery, true, 'medium');
    }
    expect(mastery.trend.length).toBeLessThanOrEqual(20);
  });

  it('does not mutate the original mastery object', () => {
    const original = initConceptMastery('loops', 0.4);
    const originalScore = original.score;
    applyAnswer(original, true, 'medium');
    expect(original.score).toBe(originalScore);
  });

  it('updates lastUpdated timestamp', () => {
    const mastery = initConceptMastery('loops', 0.4);
    const before = mastery.lastUpdated;
    // Small delay to ensure timestamp difference
    const updated = applyAnswer(mastery, true, 'medium');
    expect(typeof updated.lastUpdated).toBe('string');
    // Timestamps should be valid ISO strings
    expect(() => new Date(updated.lastUpdated)).not.toThrow();
    // The updated timestamp should be valid (same or after original)
    expect(new Date(updated.lastUpdated).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    );
  });
});

// ---- MASTERY_THRESHOLD -------------------------------------

describe('MASTERY_THRESHOLD', () => {
  it('is defined and equals 0.70', () => {
    expect(MASTERY_THRESHOLD).toBe(0.70);
  });
});

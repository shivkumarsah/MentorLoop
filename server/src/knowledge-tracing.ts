/**
 * knowledge-tracing.ts
 *
 * Pure, side-effect-free Bayesian Knowledge Tracing (BKT) implementation.
 * No API calls, no I/O, no random — fully deterministic and unit-testable.
 *
 * BKT Parameters:
 *  P_learn  — probability of transitioning from "not known" to "known" after an opportunity
 *  P_guess  — probability of correct answer despite not knowing
 *  P_slip   — probability of incorrect answer despite knowing
 *
 * These are well-established defaults; adjust per-concept if desired.
 */

import type { DifficultyLevel, MasteryMap, ConceptMastery, AdaptiveSelection } from '../../shared/types.js';

// ---- BKT Parameters ----------------------------------------

export interface BKTParams {
  pLearn: number; // P(learn) — default 0.10
  pGuess: number; // P(guess) — default 0.20
  pSlip: number;  // P(slip)  — default 0.10
}

const DEFAULT_BKT_PARAMS: BKTParams = {
  pLearn: 0.10,
  pGuess: 0.20,
  pSlip: 0.10,
};

/** Difficulty modifies effective guess/slip rates */
const DIFFICULTY_MODIFIERS: Record<DifficultyLevel, { guessAdj: number; slipAdj: number }> = {
  easy:   { guessAdj: +0.05, slipAdj: -0.02 }, // easier → higher guess prob
  medium: { guessAdj: 0,     slipAdj: 0      },
  hard:   { guessAdj: -0.05, slipAdj: +0.05  }, // harder → higher slip prob
};

// ---- Mastery threshold ------------------------------------

export const MASTERY_THRESHOLD = 0.70; // concept "mastered" if score >= this

// ---- Core BKT Update ----------------------------------------

/**
 * Update a learner's mastery score for a concept using BKT.
 *
 * Steps:
 * 1. Bayesian update: compute P(knows | evidence)
 * 2. Apply learning gain: even after observing, there's a chance of transitioning to "known"
 *
 * @param currentMastery  Current P(knows) — must be in [0, 1]
 * @param isCorrect       Whether the learner answered correctly
 * @param difficulty      Question difficulty (affects guess/slip rates)
 * @param params          BKT parameters (optional — uses defaults)
 * @returns               New mastery score, clamped to [0, 1]
 */
export function updateMastery(
  currentMastery: number,
  isCorrect: boolean,
  difficulty: DifficultyLevel = 'medium',
  params: BKTParams = DEFAULT_BKT_PARAMS
): number {
  // Clamp input
  const pKnows = Math.max(0, Math.min(1, currentMastery));

  const mod = DIFFICULTY_MODIFIERS[difficulty];
  const pGuess = Math.max(0, Math.min(1, params.pGuess + mod.guessAdj));
  const pSlip  = Math.max(0, Math.min(1, params.pSlip  + mod.slipAdj));

  // Step 1: Bayesian update
  let pKnowsGivenObs: number;
  if (isCorrect) {
    // P(knows | correct) = P(correct | knows) * P(knows) / P(correct)
    const pCorrectGivenKnows   = 1 - pSlip;
    const pCorrectGivenNotKnows = pGuess;
    const pCorrect = pKnows * pCorrectGivenKnows + (1 - pKnows) * pCorrectGivenNotKnows;
    pKnowsGivenObs = pCorrect > 0
      ? (pCorrectGivenKnows * pKnows) / pCorrect
      : pKnows;
  } else {
    // P(knows | incorrect) = P(incorrect | knows) * P(knows) / P(incorrect)
    const pIncorrectGivenKnows    = pSlip;
    const pIncorrectGivenNotKnows = 1 - pGuess;
    const pIncorrect = pKnows * pIncorrectGivenKnows + (1 - pKnows) * pIncorrectGivenNotKnows;
    pKnowsGivenObs = pIncorrect > 0
      ? (pIncorrectGivenKnows * pKnows) / pIncorrect
      : pKnows;
  }

  // Step 2: Apply learning gain — some probability of transitioning to known
  const pNew = pKnowsGivenObs + (1 - pKnowsGivenObs) * params.pLearn;

  return Math.max(0, Math.min(1, pNew));
}

/**
 * Compute the delta between old and new mastery scores.
 */
export function masteryDelta(oldScore: number, newScore: number): number {
  return Math.round((newScore - oldScore) * 1000) / 1000;
}

// ---- Adaptive Question Selection ---------------------------

/**
 * Determine which concept and difficulty to target next.
 *
 * Algorithm:
 * 1. Partition concepts into "weak" (< threshold) and "strong" (>= threshold).
 * 2. If there are weak concepts, target the weakest one (lowest mastery).
 * 3. Occasionally (interleaveRatio) pick a strong concept for spaced repetition.
 * 4. Difficulty is set by mastery band: < 0.3 → easy, 0.3–0.6 → medium, > 0.6 → hard.
 *
 * @param masteryMap      Current mastery state for all concepts
 * @param interleaveRatio Probability of spaced-repetition interleave (default 0.2)
 * @param forceInterleave Set true to force a spaced-repetition pick (for testing)
 * @returns               Selected concept, difficulty, and human-readable rationale
 */
export function selectNextConcept(
  masteryMap: MasteryMap,
  interleaveRatio: number = 0.2,
  forceInterleave: boolean = false
): AdaptiveSelection {
  const entries = Object.values(masteryMap);

  if (entries.length === 0) {
    return {
      concept: 'general',
      difficulty: 'medium',
      rationale: 'No concepts available yet; defaulting to general medium difficulty',
    };
  }

  const weakConcepts  = entries.filter((c) => c.score < MASTERY_THRESHOLD);
  const strongConcepts = entries.filter((c) => c.score >= MASTERY_THRESHOLD);

  // Decide whether to do spaced repetition
  const shouldInterleave =
    (forceInterleave || Math.random() < interleaveRatio) && strongConcepts.length > 0;

  let chosen: ConceptMastery;
  let strategyLabel: string;

  if (shouldInterleave && strongConcepts.length > 0) {
    // Spaced repetition: pick a strong concept at random
    const idx = Math.floor(Math.random() * strongConcepts.length);
    chosen = strongConcepts[idx]!;
    strategyLabel = `spaced-repetition interleave (mastery=${chosen.score.toFixed(2)} >= threshold ${MASTERY_THRESHOLD})`;
  } else if (weakConcepts.length > 0) {
    // Target weakest concept
    const sorted = [...weakConcepts].sort((a, b) => a.score - b.score);
    chosen = sorted[0]!;
    strategyLabel = `weakest concept (mastery=${chosen.score.toFixed(2)} < threshold ${MASTERY_THRESHOLD})`;
  } else {
    // All mastered — pick the lowest of strong concepts to push higher
    const sorted = [...strongConcepts].sort((a, b) => a.score - b.score);
    chosen = sorted[0]!;
    strategyLabel = `all mastered; targeting lowest strong concept (mastery=${chosen.score.toFixed(2)})`;
  }

  const difficulty = masteryToDifficulty(chosen.score);

  return {
    concept: chosen.concept,
    difficulty,
    rationale: `selected because ${chosen.concept} is the ${strategyLabel}; difficulty set to "${difficulty}" based on mastery score`,
  };
}

/**
 * Map a mastery score to a difficulty level.
 *  < 0.30 → easy
 *  0.30–0.60 → medium
 *  > 0.60 → hard
 */
export function masteryToDifficulty(score: number): DifficultyLevel {
  if (score < 0.30) return 'easy';
  if (score < 0.60) return 'medium';
  return 'hard';
}

// ---- Spaced Repetition Check --------------------------------

/**
 * Determine if spaced repetition should be triggered.
 * Returns true if enough concepts are mastered to warrant interleaving.
 */
export function shouldTriggerSpacedRepetition(masteryMap: MasteryMap): boolean {
  const entries = Object.values(masteryMap);
  if (entries.length === 0) return false;
  const mastered = entries.filter((c) => c.score >= MASTERY_THRESHOLD).length;
  return mastered > 0 && mastered / entries.length >= 0.3;
}

// ---- Overall Mastery ----------------------------------------

/**
 * Compute the aggregate mastery score across all concepts (simple mean).
 */
export function overallMastery(masteryMap: MasteryMap): number {
  const entries = Object.values(masteryMap);
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, c) => acc + c.score, 0);
  return Math.round((sum / entries.length) * 1000) / 1000;
}

/**
 * Get weak concepts (below threshold), sorted by ascending mastery.
 */
export function getWeakConcepts(masteryMap: MasteryMap): string[] {
  return Object.values(masteryMap)
    .filter((c) => c.score < MASTERY_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .map((c) => c.concept);
}

/**
 * Get strong (mastered) concepts.
 */
export function getStrongConcepts(masteryMap: MasteryMap): string[] {
  return Object.values(masteryMap)
    .filter((c) => c.score >= MASTERY_THRESHOLD)
    .map((c) => c.concept);
}

/**
 * Create a new blank ConceptMastery record with initial score.
 */
export function initConceptMastery(concept: string, initialScore: number = 0.1): ConceptMastery {
  return {
    concept,
    score: Math.max(0, Math.min(1, initialScore)),
    attempts: 0,
    correctAttempts: 0,
    lastUpdated: new Date().toISOString(),
    trend: [initialScore],
  };
}

/**
 * Update a ConceptMastery record after an answer.
 * Returns a new immutable record (no mutation).
 */
export function applyAnswer(
  mastery: ConceptMastery,
  isCorrect: boolean,
  difficulty: DifficultyLevel,
  params?: BKTParams
): ConceptMastery {
  const newScore = updateMastery(mastery.score, isCorrect, difficulty, params);
  return {
    ...mastery,
    score: newScore,
    attempts: mastery.attempts + 1,
    correctAttempts: mastery.correctAttempts + (isCorrect ? 1 : 0),
    lastUpdated: new Date().toISOString(),
    trend: [...mastery.trend, newScore].slice(-20), // keep last 20 data points
  };
}

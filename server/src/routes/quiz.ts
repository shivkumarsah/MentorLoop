/**
 * routes/quiz.ts
 * POST /api/quiz/next  — get next adaptively-selected quiz question
 * POST /api/quiz/answer — submit answer, get feedback + updated mastery
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getGeminiService } from '../gemini-service.js';
import { getSession, updateSessionMastery, appendEvent } from '../db.js';
import {
  selectNextConcept,
  applyAnswer,
  masteryDelta,
} from '../knowledge-tracing.js';
import type { QuizAnswerRequest, QuizAnswerResponse } from '../../../shared/types.js';

export const quizRouter = Router();

// ---- POST /api/quiz/next -----------------------------------

const NextSchema = z.object({
  sessionId: z.string().uuid(),
});

quizRouter.post('/next', async (req: Request, res: Response): Promise<void> => {
  const parsed = NextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { sessionId } = parsed.data;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Adaptive concept & difficulty selection
    const selection = selectNextConcept(session.masteryState);

    // Generate question via Gemini
    const gemini = getGeminiService();
    const question = await gemini.generateQuizQuestion(
      selection.concept,
      session.topic,
      selection.difficulty
    );

    // Attach the adaptive selection rationale
    const responseQuestion = {
      ...question,
      rationale: selection.rationale,
    };

    res.json(responseQuestion);
  } catch (err) {
    console.error('Error getting next quiz question:', err);
    res.status(500).json({ error: 'Failed to get next question', details: String(err) });
  }
});

// ---- POST /api/quiz/answer ---------------------------------

const AnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().min(1),
  concept: z.string().min(1).max(100),
  answer: z.string().min(1).max(500),
  correctAnswer: z.string().min(1).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  question: z.string().min(1).max(1000), // full question text for feedback generation
});

quizRouter.post('/answer', async (req: Request, res: Response): Promise<void> => {
  const parsed = AnswerSchema.safeParse(req.body as QuizAnswerRequest & { question: string });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { sessionId, concept, answer, correctAnswer, difficulty, question } = parsed.data;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

    const currentMastery = session.masteryState[concept] ?? {
      concept,
      score: 0.1,
      attempts: 0,
      correctAttempts: 0,
      lastUpdated: new Date().toISOString(),
      trend: [0.1],
    };

    const oldScore = currentMastery.score;
    const updatedMastery = applyAnswer(currentMastery, isCorrect, difficulty);
    const delta = masteryDelta(oldScore, updatedMastery.score);

    // Persist mastery update
    await updateSessionMastery(sessionId, concept, updatedMastery);

    // Log event
    await appendEvent(sessionId, 'quiz_answer', concept, {
      isCorrect,
      masteryBefore: oldScore,
      masteryAfter: updatedMastery.score,
    });

    // Generate AI feedback
    const gemini = getGeminiService();
    let feedback: string;

    if (isCorrect) {
      feedback = `✓ Correct! ${concept} mastery increased to ${(updatedMastery.score * 100).toFixed(0)}%.`;
    } else {
      feedback = await gemini.generateMisconceptionFeedback(
        concept,
        question,
        answer,
        correctAnswer
      );
    }

    // Re-read updated session for response
    const updatedSession = await getSession(sessionId);

    const response: QuizAnswerResponse = {
      isCorrect,
      feedback,
      masteryDelta: delta,
      newMastery: updatedMastery.score,
      updatedMasteryMap: updatedSession?.masteryState ?? session.masteryState,
    };

    res.json(response);
  } catch (err) {
    console.error('Error processing quiz answer:', err);
    res.status(500).json({ error: 'Failed to process answer', details: String(err) });
  }
});

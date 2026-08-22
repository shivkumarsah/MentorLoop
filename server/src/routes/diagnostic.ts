/**
 * routes/diagnostic.ts
 * POST /api/diagnostic/answer — submit a diagnostic answer, get next adaptive question
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getGeminiService } from '../gemini-service.js';
import { getSession, updateSessionMastery, setDiagnosticComplete, appendEvent } from '../db.js';
import { applyAnswer, masteryDelta, selectNextConcept } from '../knowledge-tracing.js';
import type { DiagnosticAnswerRequest, DiagnosticAnswerResponse } from '../../../shared/types.js';

export const diagnosticRouter = Router();

const DIAGNOSTIC_QUESTIONS_TOTAL = 5;

const AnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().min(1),
  concept: z.string().min(1).max(100),
  answer: z.string().min(1).max(500),
  correctAnswer: z.string().min(1).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionNumber: z.number().int().min(1).max(DIAGNOSTIC_QUESTIONS_TOTAL),
});

diagnosticRouter.post('/answer', async (req: Request, res: Response): Promise<void> => {
  const parsed = AnswerSchema.safeParse(req.body as DiagnosticAnswerRequest & { questionNumber: number });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { sessionId, concept, answer, correctAnswer, difficulty, questionNumber } = parsed.data;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

    // Get current mastery for concept (or create default)
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

    // Persist updated mastery
    await updateSessionMastery(sessionId, concept, updatedMastery);

    // Log event
    await appendEvent(sessionId, 'diagnostic_answer', concept, {
      isCorrect,
      masteryBefore: oldScore,
      masteryAfter: updatedMastery.score,
    });

    const diagnosticComplete = questionNumber >= DIAGNOSTIC_QUESTIONS_TOTAL;

    let nextQuestion = null;

    if (!diagnosticComplete) {
      // Re-read session for updated mastery map
      const updatedSession = await getSession(sessionId);
      const masteryMap = updatedSession!.masteryState;

      // Adaptive selection for next diagnostic question
      const selection = selectNextConcept(masteryMap, 0); // no spaced repetition during diagnostic
      const gemini = getGeminiService();
      const questions = await gemini.generateDiagnosticQuestions(
        session.topic,
        [selection.concept],
        1
      );
      nextQuestion = questions[0] ?? null;
      if (nextQuestion) {
        nextQuestion = { ...nextQuestion, concept: selection.concept, difficulty: selection.difficulty };
      }
    } else {
      await setDiagnosticComplete(sessionId);
    }

    const response: DiagnosticAnswerResponse = {
      isCorrect,
      masteryDelta: delta,
      newMastery: updatedMastery.score,
      nextQuestion,
      diagnosticComplete,
      conceptsEstimated: Object.keys(session.masteryState),
    };

    res.json(response);
  } catch (err) {
    console.error('Error processing diagnostic answer:', err);
    res.status(500).json({ error: 'Failed to process answer', details: String(err) });
  }
});

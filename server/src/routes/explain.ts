/**
 * routes/explain.ts
 * POST /api/explain — get a Gemini-generated explanation adapted to mastery level
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getGeminiService } from '../gemini-service.js';
import { getSession, getCachedExplanation, cacheExplanation, appendEvent } from '../db.js';
import type { ExplanationRequest, ExplanationResponse } from '../../../shared/types.js';

export const explainRouter = Router();

const ExplainSchema = z.object({
  sessionId: z.string().uuid(),
  concept: z.string().min(1).max(100).transform((s) => s.trim()),
  style: z.enum(['beginner', 'technical']),
});

explainRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = ExplainSchema.safeParse(req.body as ExplanationRequest);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { sessionId, concept, style } = parsed.data;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const masteryLevel = session.masteryState[concept]?.score ?? 0.1;

    // Check cache first (avoid redundant Gemini calls within a session)
    const cached = await getCachedExplanation(sessionId, concept, style);
    if (cached) {
      const response: ExplanationResponse = {
        concept,
        explanation: cached,
        style,
        masteryLevel,
        cached: true,
      };
      res.json(response);
      return;
    }

    // Generate explanation via Gemini
    const gemini = getGeminiService();
    const explanation = await gemini.generateExplanation(concept, session.topic, masteryLevel, style);

    // Cache for future requests
    await cacheExplanation(sessionId, concept, style, explanation);

    // Log event
    await appendEvent(sessionId, 'explanation_viewed', concept);

    const response: ExplanationResponse = {
      concept,
      explanation,
      style,
      masteryLevel,
      cached: false,
    };

    res.json(response);
  } catch (err) {
    console.error('Error generating explanation:', err);
    res.status(500).json({ error: 'Failed to generate explanation', details: String(err) });
  }
});

/**
 * routes/mastery.ts
 * GET /api/mastery/:sessionId — current mastery state per concept
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSession } from '../db.js';
import { overallMastery, getWeakConcepts, getStrongConcepts, selectNextConcept } from '../knowledge-tracing.js';
import type { MasteryResponse } from '../../../shared/types.js';

export const masteryRouter = Router();

const ParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

masteryRouter.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const parsed = ParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid session ID format' });
    return;
  }

  const { sessionId } = parsed.data;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const masteryMap = session.masteryState;
    const overall = overallMastery(masteryMap);
    const weakConcepts = getWeakConcepts(masteryMap);
    const strongConcepts = getStrongConcepts(masteryMap);

    // Recommend next topic
    const selection = selectNextConcept(masteryMap, 0);
    const recommendedNext = selection.concept;

    const response: MasteryResponse = {
      sessionId,
      topic: session.topic,
      masteryMap,
      overallMastery: overall,
      weakConcepts,
      strongConcepts,
      recommendedNext,
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching mastery:', err);
    res.status(500).json({ error: 'Failed to fetch mastery state', details: String(err) });
  }
});

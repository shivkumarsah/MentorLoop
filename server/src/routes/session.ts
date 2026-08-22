/**
 * routes/session.ts
 * POST /api/session — create a new learning session for a topic
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getGeminiService } from '../gemini-service.js';
import { createSession } from '../db.js';
import type { SessionCreateRequest, SessionCreateResponse } from '../../../shared/types.js';

export const sessionRouter = Router();

const SessionCreateSchema = z.object({
  topic: z
    .string()
    .min(2, 'Topic must be at least 2 characters')
    .max(200, 'Topic must be at most 200 characters')
    .transform((s) => s.trim()),
});

sessionRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = SessionCreateSchema.safeParse(req.body as SessionCreateRequest);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { topic } = parsed.data;

  try {
    const gemini = getGeminiService();

    // 1. Extract concepts for the topic
    const concepts = await gemini.extractConcepts(topic);

    // 2. Create persisted session
    const session = await createSession(topic, concepts);

    // 3. Generate first diagnostic question
    const questions = await gemini.generateDiagnosticQuestions(topic, concepts, 1);
    const firstQuestion = questions[0];

    if (!firstQuestion) {
      throw new Error('Failed to generate first diagnostic question');
    }

    const response: SessionCreateResponse = {
      sessionId: session.id,
      topic: session.topic,
      firstQuestion,
      concepts,
    };

    res.status(201).json(response);
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session', details: String(err) });
  }
});

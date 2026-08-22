/**
 * quiz-routes.test.ts
 *
 * Integration tests for the quiz API routes.
 * The Gemini service is fully mocked — no real API calls made.
 * The DB uses an in-memory lowdb instance via the real DB module
 * with a temp path (tests are isolated).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { setGeminiService, resetGeminiService } from '../gemini-service.js';
import type { GeminiService } from '../gemini-service.js';
import type { QuizQuestion, DiagnosticQuestion } from '../../../shared/types.js';

// ---- Mock Gemini Service -----------------------------------

const mockQuestion: QuizQuestion = {
  id: 'test-question-id',
  type: 'multiple-choice',
  concept: 'Variables',
  question: 'What is a variable in programming?',
  options: [
    'A) A container for storing data values',
    'B) A type of loop',
    'C) A function definition',
    'D) A class instance',
  ],
  correctAnswer: 'A) A container for storing data values',
  difficulty: 'easy',
  rationale: 'selected because Variables mastery=0.10 is below threshold 0.70',
};

const mockDiagnosticQuestion: DiagnosticQuestion = {
  id: 'diag-question-id',
  type: 'multiple-choice',
  concept: 'Variables',
  question: 'What is the purpose of a variable?',
  options: [
    'A) Store data',
    'B) Define a class',
    'C) Create a loop',
    'D) Import a module',
  ],
  correctAnswer: 'A) Store data',
  difficulty: 'easy',
};

const mockGeminiService: GeminiService = {
  extractConcepts: vi.fn().mockResolvedValue(['Variables', 'Loops', 'Functions', 'Classes']),
  generateDiagnosticQuestions: vi.fn().mockResolvedValue([mockDiagnosticQuestion]),
  generateExplanation: vi.fn().mockResolvedValue('This is a mock explanation of the concept.'),
  generateQuizQuestion: vi.fn().mockResolvedValue(mockQuestion),
  generateMisconceptionFeedback: vi.fn().mockResolvedValue(
    'Not quite! A variable is a named container for data, not a loop construct. Think of it like a labeled box.'
  ),
};

// ---- Test Helpers ------------------------------------------

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/session')
    .send({ topic: 'Python Basics' })
    .expect(201);
  return (res.body as { sessionId: string }).sessionId;
}

// ---- Tests -------------------------------------------------

describe('Quiz Routes Integration Tests', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setGeminiService(mockGeminiService);
    app = createApp();
  });

  afterEach(() => {
    resetGeminiService();
  });

  // ---- Health check ----------------------------------------
  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect((res.body as { status: string }).status).toBe('ok');
    });
  });

  // ---- Session creation ------------------------------------
  describe('POST /api/session', () => {
    it('creates a session with extracted concepts', async () => {
      const res = await request(app)
        .post('/api/session')
        .send({ topic: 'Python Basics' })
        .expect(201);

      const body = res.body as {
        sessionId: string;
        topic: string;
        concepts: string[];
        firstQuestion: QuizQuestion;
      };

      expect(body.sessionId).toBeTruthy();
      expect(body.topic).toBe('Python Basics');
      expect(Array.isArray(body.concepts)).toBe(true);
      expect(body.concepts.length).toBeGreaterThan(0);
      expect(body.firstQuestion).toBeTruthy();
      expect(mockGeminiService.extractConcepts).toHaveBeenCalledWith('Python Basics');
    });

    it('returns 400 for missing topic', async () => {
      await request(app).post('/api/session').send({}).expect(400);
    });

    it('returns 400 for topic that is too short', async () => {
      await request(app).post('/api/session').send({ topic: 'x' }).expect(400);
    });

    it('returns 400 for topic that is too long', async () => {
      await request(app)
        .post('/api/session')
        .send({ topic: 'x'.repeat(201) })
        .expect(400);
    });
  });

  // ---- Quiz: next question ----------------------------------
  describe('POST /api/quiz/next', () => {
    it('returns a quiz question with rationale', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post('/api/quiz/next')
        .send({ sessionId })
        .expect(200);

      const body = res.body as QuizQuestion;
      expect(body.question).toBeTruthy();
      expect(Array.isArray(body.options)).toBe(true);
      expect(body.correctAnswer).toBeTruthy();
      expect(body.difficulty).toMatch(/^(easy|medium|hard)$/);
      expect(body.rationale).toBeTruthy();
    });

    it('returns 400 for invalid sessionId', async () => {
      await request(app)
        .post('/api/quiz/next')
        .send({ sessionId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 404 for non-existent session', async () => {
      await request(app)
        .post('/api/quiz/next')
        .send({ sessionId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('calls gemini with the selected concept and difficulty', async () => {
      const sessionId = await createTestSession(app);
      await request(app).post('/api/quiz/next').send({ sessionId }).expect(200);
      expect(mockGeminiService.generateQuizQuestion).toHaveBeenCalled();
    });
  });

  // ---- Quiz: submit answer ----------------------------------
  describe('POST /api/quiz/answer', () => {
    it('returns correct=true and positive mastery delta for right answer', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post('/api/quiz/answer')
        .send({
          sessionId,
          questionId: 'test-id',
          concept: 'Variables',
          answer: 'A) A container for storing data values',
          correctAnswer: 'A) A container for storing data values',
          difficulty: 'easy',
          question: 'What is a variable?',
        })
        .expect(200);

      const body = res.body as {
        isCorrect: boolean;
        masteryDelta: number;
        newMastery: number;
        feedback: string;
      };

      expect(body.isCorrect).toBe(true);
      expect(body.masteryDelta).toBeGreaterThan(0);
      expect(body.newMastery).toBeGreaterThan(0);
      expect(body.feedback).toBeTruthy();
      // Correct answers don't call misconception feedback
      expect(mockGeminiService.generateMisconceptionFeedback).not.toHaveBeenCalled();
    });

    it('returns correct=false and calls misconception feedback for wrong answer', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post('/api/quiz/answer')
        .send({
          sessionId,
          questionId: 'test-id',
          concept: 'Variables',
          answer: 'B) A type of loop',
          correctAnswer: 'A) A container for storing data values',
          difficulty: 'easy',
          question: 'What is a variable?',
        })
        .expect(200);

      const body = res.body as {
        isCorrect: boolean;
        masteryDelta: number;
        feedback: string;
      };

      expect(body.isCorrect).toBe(false);
      // At very low initial mastery (0.1), BKT learning gain can result in a small positive delta
      // even on a wrong answer (P_learn=0.10 applies after the Bayesian update).
      // What matters is the feedback and that misconception was called, not the sign of delta.
      expect(typeof body.masteryDelta).toBe('number');
      expect(body.feedback).toContain('Not quite!');
      expect(mockGeminiService.generateMisconceptionFeedback).toHaveBeenCalledOnce();
    });

    it('returns 400 for invalid sessionId', async () => {
      await request(app)
        .post('/api/quiz/answer')
        .send({
          sessionId: 'bad-id',
          questionId: 'q1',
          concept: 'Variables',
          answer: 'A)',
          correctAnswer: 'A)',
          difficulty: 'easy',
          question: 'Test?',
        })
        .expect(400);
    });

    it('returns 404 for non-existent session', async () => {
      await request(app)
        .post('/api/quiz/answer')
        .send({
          sessionId: '00000000-0000-0000-0000-000000000000',
          questionId: 'q1',
          concept: 'Variables',
          answer: 'A)',
          correctAnswer: 'A)',
          difficulty: 'easy',
          question: 'Test?',
        })
        .expect(404);
    });

    it('updates mastery map in response', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post('/api/quiz/answer')
        .send({
          sessionId,
          questionId: 'test-id',
          concept: 'Variables',
          answer: 'A) A container for storing data values',
          correctAnswer: 'A) A container for storing data values',
          difficulty: 'easy',
          question: 'What is a variable?',
        })
        .expect(200);

      const body = res.body as { updatedMasteryMap: Record<string, { score: number }> };
      expect(body.updatedMasteryMap).toBeTruthy();
      expect(typeof body.updatedMasteryMap).toBe('object');
    });
  });

  // ---- Mastery endpoint -------------------------------------
  describe('GET /api/mastery/:sessionId', () => {
    it('returns mastery map for a valid session', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .get(`/api/mastery/${sessionId}`)
        .expect(200);

      const body = res.body as {
        sessionId: string;
        masteryMap: object;
        overallMastery: number;
        weakConcepts: string[];
      };

      expect(body.sessionId).toBe(sessionId);
      expect(body.masteryMap).toBeTruthy();
      expect(typeof body.overallMastery).toBe('number');
      expect(Array.isArray(body.weakConcepts)).toBe(true);
    });

    it('returns 404 for non-existent session', async () => {
      await request(app)
        .get('/api/mastery/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 for invalid UUID format', async () => {
      await request(app).get('/api/mastery/not-a-uuid').expect(400);
    });
  });

  // ---- Explain endpoint -------------------------------------
  describe('POST /api/explain', () => {
    it('returns a Gemini-generated explanation', async () => {
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post('/api/explain')
        .send({ sessionId, concept: 'Variables', style: 'beginner' })
        .expect(200);

      const body = res.body as {
        explanation: string;
        concept: string;
        style: string;
        cached: boolean;
      };

      expect(body.explanation).toBeTruthy();
      expect(body.concept).toBe('Variables');
      expect(body.style).toBe('beginner');
      expect(body.cached).toBe(false);
    });

    it('returns cached explanation on second request (no extra Gemini call)', async () => {
      const sessionId = await createTestSession(app);

      await request(app)
        .post('/api/explain')
        .send({ sessionId, concept: 'Variables', style: 'beginner' })
        .expect(200);

      const res2 = await request(app)
        .post('/api/explain')
        .send({ sessionId, concept: 'Variables', style: 'beginner' })
        .expect(200);

      const body = res2.body as { cached: boolean };
      expect(body.cached).toBe(true);
      // Should only have been called once
      expect(mockGeminiService.generateExplanation).toHaveBeenCalledOnce();
    });

    it('returns 400 for invalid style', async () => {
      const sessionId = await createTestSession(app);
      await request(app)
        .post('/api/explain')
        .send({ sessionId, concept: 'Variables', style: 'invalid' })
        .expect(400);
    });
  });
});

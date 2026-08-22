import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  createSession,
  submitDiagnosticAnswer,
  getMastery,
  getExplanation,
  getNextQuizQuestion,
  submitQuizAnswer,
} from '../api/client';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('Typed API Client', () => {
  const mockAxios = (axios.create as unknown as () => { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> })();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession sends POST to /session', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { sessionId: 'sess-1', topic: 'Python', concepts: ['Vars'], firstQuestion: {} },
    });

    const res = await createSession('Python');
    expect(mockAxios.post).toHaveBeenCalledWith('/session', { topic: 'Python' });
    expect(res.sessionId).toBe('sess-1');
  });

  it('submitDiagnosticAnswer sends POST to /diagnostic/answer', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { isCorrect: true, masteryDelta: 0.1, newMastery: 0.5, diagnosticComplete: false },
    });

    const res = await submitDiagnosticAnswer({
      sessionId: 'sess-1',
      questionId: 'q-1',
      concept: 'Vars',
      answer: 'A',
      correctAnswer: 'A',
      difficulty: 'easy',
      questionNumber: 1,
    });
    expect(mockAxios.post).toHaveBeenCalledWith('/diagnostic/answer', expect.any(Object));
    expect(res.isCorrect).toBe(true);
  });

  it('getMastery sends GET to /mastery/:sessionId', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: { sessionId: 'sess-1', overallMastery: 0.8, masteryMap: {}, weakConcepts: [], strongConcepts: [] },
    });

    const res = await getMastery('sess-1');
    expect(mockAxios.get).toHaveBeenCalledWith('/mastery/sess-1');
    expect(res.overallMastery).toBe(0.8);
  });

  it('getExplanation sends POST to /explain', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { concept: 'Vars', explanation: 'A variable holds data.', cached: false },
    });

    const res = await getExplanation({ sessionId: 'sess-1', concept: 'Vars', style: 'beginner' });
    expect(mockAxios.post).toHaveBeenCalledWith('/explain', { sessionId: 'sess-1', concept: 'Vars', style: 'beginner' });
    expect(res.explanation).toBe('A variable holds data.');
  });

  it('getNextQuizQuestion and submitQuizAnswer send requests to /quiz/*', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { id: 'q-1', concept: 'Loops', question: 'What is a loop?', options: [], correctAnswer: 'A', difficulty: 'medium' },
    });

    const q = await getNextQuizQuestion('sess-1');
    expect(mockAxios.post).toHaveBeenCalledWith('/quiz/next', { sessionId: 'sess-1' });
    expect(q.id).toBe('q-1');

    mockAxios.post.mockResolvedValueOnce({
      data: { isCorrect: true, feedback: 'Correct!', masteryDelta: 0.1, newMastery: 0.7, updatedMasteryMap: {} },
    });

    const ans = await submitQuizAnswer({
      sessionId: 'sess-1',
      questionId: 'q-1',
      concept: 'Loops',
      answer: 'A',
      correctAnswer: 'A',
      difficulty: 'medium',
      question: 'What is a loop?',
    });
    expect(ans.isCorrect).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { MockGeminiService } from '../gemini-service.js';

describe('MockGeminiService Unit Tests', () => {
  const service = new MockGeminiService();

  it('extractConcepts returns 5 default concepts when topic matches or fallback applies', async () => {
    const concepts = await service.extractConcepts('Python basics');
    expect(concepts.length).toBeGreaterThanOrEqual(4);
    expect(concepts).toContain('Variables');
  });

  it('generateDiagnosticQuestions returns requested count of diagnostic questions', async () => {
    const questions = await service.generateDiagnosticQuestions(
      'Python basics',
      ['Variables', 'Loops', 'Functions'],
      3
    );
    expect(questions.length).toBe(3);
    expect(questions[0]).toHaveProperty('id');
    expect(questions[0]).toHaveProperty('question');
    expect(questions[0]?.options.length).toBe(4);
  });

  it('generateExplanation provides beginner and technical styled explanations', async () => {
    const beginner = await service.generateExplanation('Variables', 'Python', 0.2, 'beginner');
    expect(beginner).toContain('Variables');
    expect(beginner.length).toBeGreaterThan(50);

    const technical = await service.generateExplanation('Variables', 'Python', 0.8, 'technical');
    expect(technical).toContain('Variables');
  });

  it('generateQuizQuestion returns well-formed quiz question with selected difficulty', async () => {
    const q = await service.generateQuizQuestion('Loops', 'Python', 'hard');
    expect(q.concept).toBe('Loops');
    expect(q.difficulty).toBe('hard');
    expect(q.options.length).toBe(4);
    expect(q.options).toContain(q.correctAnswer);
  });

  it('generateMisconceptionFeedback provides informative corrective feedback', async () => {
    const feedback = await service.generateMisconceptionFeedback(
      'Variables',
      'What is a variable?',
      'B) A loop',
      'A) A data container'
    );
    expect(feedback).toContain('Not quite');
    expect(feedback).toContain('Variables');
  });
});

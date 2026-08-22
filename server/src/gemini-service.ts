/**
 * gemini-service.ts
 *
 * Isolated Gemini API integration layer.
 * All AI calls go through this module — never call Gemini directly from routes.
 * This design makes it trivially mockable in tests.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { DiagnosticQuestion, QuizQuestion, DifficultyLevel, ExplanationStyle } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

// ---- Interface (for mocking in tests) ----------------------

export interface GeminiService {
  generateDiagnosticQuestions(
    topic: string,
    concepts: string[],
    count: number
  ): Promise<DiagnosticQuestion[]>;

  generateExplanation(
    concept: string,
    topic: string,
    masteryLevel: number,
    style: ExplanationStyle
  ): Promise<string>;

  generateQuizQuestion(
    concept: string,
    topic: string,
    difficulty: DifficultyLevel
  ): Promise<QuizQuestion>;

  generateMisconceptionFeedback(
    concept: string,
    question: string,
    wrongAnswer: string,
    correctAnswer: string
  ): Promise<string>;

  extractConcepts(topic: string): Promise<string[]>;
}

// ---- Safety settings (block harmful content) ---------------

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// ---- JSON parse helper -------------------------------------

function tryParseJSON<T>(text: string): T | null {
  if (!text) return null;
  // 1. Try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {}

  // 2. Try stripping markdown code fences
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // 3. Try finding bracketed JSON array or object
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {}
  }

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T;
    } catch {}
  }

  return null;
}

// ---- Real Gemini Service Implementation --------------------

class RealGeminiService implements GeminiService {
  private model;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env['GEMINI_MODEL'] || 'gemini-3.6-flash';
    this.model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
  }

  async extractConcepts(topic: string): Promise<string[]> {
    const prompt = `
You are an expert curriculum designer. Given the learning topic "${topic}", identify 4-6 core sub-concepts that a learner must understand.

Return ONLY a JSON array of short concept names (2-4 words each), ordered from foundational to advanced.
Example output: ["Basic Syntax", "Variables", "Control Flow", "Functions", "Modules"]

Topic: ${topic}
Output (JSON array only):
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const parsed = tryParseJSON<string[]>(text);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      // Fallback: extract concept-like strings from the text
      const lines = text.split('\n').filter((l) => l.trim().startsWith('"') || l.trim().startsWith('-'));
      const concepts = lines.map((l) => l.replace(/["\-,[\]]/g, '').trim()).filter(Boolean);
      return concepts.length > 0
        ? concepts.slice(0, 6)
        : ['Core Concepts', 'Fundamentals', 'Applications', 'Advanced Topics'];
    }

    return parsed.slice(0, 6);
  }

  async generateDiagnosticQuestions(
    topic: string,
    concepts: string[],
    count: number
  ): Promise<DiagnosticQuestion[]> {
    const prompt = `
You are an expert educator creating a diagnostic assessment for the topic: "${topic}".

Generate exactly ${count} multiple-choice diagnostic questions covering these concepts: ${concepts.join(', ')}.
Mix difficulty levels (easy, medium, hard) — start easier and get progressively harder.

Return ONLY a JSON array. Each object must have:
{
  "concept": "<one of the provided concepts>",
  "question": "<the question text>",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctAnswer": "<exact text of correct option, e.g. 'A) ...'>" ,
  "difficulty": "easy" | "medium" | "hard"
}

Topic: ${topic}
Concepts: ${concepts.join(', ')}
Output (JSON array only):
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    type RawQuestion = Omit<DiagnosticQuestion, 'id' | 'type'>;
    const parsed = tryParseJSON<RawQuestion[] | { questions?: RawQuestion[]; question?: string }>(text);

    let questionsList: RawQuestion[] = [];
    if (Array.isArray(parsed)) {
      questionsList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if ('questions' in parsed && Array.isArray(parsed.questions)) {
        questionsList = parsed.questions;
      } else if ('question' in parsed && typeof parsed.question === 'string') {
        questionsList = [parsed as RawQuestion];
      }
    }

    if (questionsList.length === 0) {
      throw new Error('Gemini returned invalid JSON for diagnostic questions');
    }

    return questionsList.map((q) => ({
      id: uuidv4(),
      type: 'multiple-choice' as const,
      concept: q.concept ?? concepts[0] ?? 'General',
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty ?? 'medium',
    }));
  }

  async generateExplanation(
    concept: string,
    topic: string,
    masteryLevel: number,
    style: ExplanationStyle
  ): Promise<string> {
    const depthDesc =
      masteryLevel < 0.3
        ? 'a complete beginner with no prior knowledge'
        : masteryLevel < 0.6
        ? 'someone with basic familiarity but needing deeper understanding'
        : 'an advanced learner who understands the basics and wants depth';

    const styleInstruction =
      style === 'beginner'
        ? 'Use simple language, analogies, and real-world examples. Avoid jargon.'
        : 'Use precise technical language. Include formal definitions, edge cases, and implementation details.';

    const prompt = `
You are a world-class educator explaining "${concept}" in the context of "${topic}".

The learner is ${depthDesc} (mastery score: ${(masteryLevel * 100).toFixed(0)}%).
${styleInstruction}

Write a clear, engaging explanation (3-5 paragraphs). Structure it as:
1. What it is (definition/core idea)
2. Why it matters / real-world relevance
3. How it works (with an example)
4. Common misconceptions or pitfalls to avoid

Do NOT include headers or markdown symbols. Write in flowing prose.
`.trim();

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }

  async generateQuizQuestion(
    concept: string,
    topic: string,
    difficulty: DifficultyLevel
  ): Promise<QuizQuestion> {
    const difficultyGuide = {
      easy: 'a basic recall or recognition question with a clearly correct answer',
      medium: 'a comprehension or application question requiring understanding of how it works',
      hard: 'an analysis or synthesis question involving edge cases, trade-offs, or multi-step reasoning',
    }[difficulty];

    const prompt = `
You are creating a ${difficulty}-difficulty quiz question about "${concept}" in the context of "${topic}".
The question should be ${difficultyGuide}.

Return ONLY a JSON object with:
{
  "question": "<the question text>",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctAnswer": "<exact text of correct option>"
}

Output (JSON only):
`.trim();

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    const parsed = tryParseJSON<{ question: string; options: string[]; correctAnswer: string }>(text);

    if (!parsed || !parsed.question) {
      throw new Error('Gemini returned invalid JSON for quiz question');
    }

    return {
      id: uuidv4(),
      type: 'multiple-choice',
      concept,
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      difficulty,
      rationale: '', // filled in by route handler
    };
  }

  async generateMisconceptionFeedback(
    concept: string,
    question: string,
    wrongAnswer: string,
    correctAnswer: string
  ): Promise<string> {
    const prompt = `
A student answered a question about "${concept}" incorrectly.

Question: ${question}
Student's answer: ${wrongAnswer}
Correct answer: ${correctAnswer}

Write a SHORT (2-3 sentence) explanation that:
1. Acknowledges the misconception without being condescending
2. Clearly explains WHY the correct answer is right
3. Gives a quick tip to remember it

Be encouraging and educational. Do NOT start with "I" or "The student".
`.trim();

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }
}

// ---- Built-in Mock Service (for testing and offline development) ----

export class MockGeminiService implements GeminiService {
  async extractConcepts(topic: string): Promise<string[]> {
    if (topic.toLowerCase().includes('python')) {
      return ['Variables', 'Data Types', 'Control Flow', 'Functions', 'OOP Basics'];
    }
    return [`${topic} Fundamentals`, `${topic} Core Principles`, `${topic} Applications`, `${topic} Advanced Methods`];
  }

  async generateDiagnosticQuestions(topic: string, concepts: string[], count: number): Promise<DiagnosticQuestion[]> {
    return concepts.slice(0, count).map((concept, idx) => ({
      id: uuidv4(),
      type: 'multiple-choice',
      concept,
      question: `What is the primary significance of ${concept} in ${topic}?`,
      options: [
        `A) Core fundamental mechanism for ${concept}`,
        `B) Secondary auxiliary function`,
        `C) Unrelated legacy concept`,
        `D) Deprecated syntax pattern`,
      ],
      correctAnswer: `A) Core fundamental mechanism for ${concept}`,
      difficulty: idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard',
    }));
  }

  async generateExplanation(concept: string, topic: string, _masteryLevel: number, style: ExplanationStyle): Promise<string> {
    if (style === 'beginner') {
      return `Think of ${concept} in ${topic} like a labeled box in a storage room. It stores values safely and makes them easy to find whenever your program needs them.`;
    }
    return `In ${topic}, ${concept} is a fundamental architectural building block that provides memory binding, state encapsulation, and precise control flow primitives.`;
  }

  async generateQuizQuestion(concept: string, topic: string, difficulty: DifficultyLevel): Promise<QuizQuestion> {
    return {
      id: uuidv4(),
      type: 'multiple-choice',
      concept,
      question: `In ${topic}, which statement correctly characterizes ${concept}?`,
      options: [
        `A) Primary mechanism for executing ${concept} logic`,
        `B) An optional configuration flag`,
        `C) Standard error code`,
        `D) Network latency threshold`,
      ],
      correctAnswer: `A) Primary mechanism for executing ${concept} logic`,
      difficulty,
      rationale: `Selected because ${concept} is an active learning target`,
    };
  }

  async generateMisconceptionFeedback(concept: string, _question: string, _wrongAnswer: string, _correctAnswer: string): Promise<string> {
    return `Not quite. In ${concept}, the selected option is a common misconception. Remember that ${concept} directly regulates state rather than acting as a static configuration.`;
  }
}

export function createMockGeminiService(): GeminiService {
  return new MockGeminiService();
}

// ---- Factory -----------------------------------------------

let _serviceInstance: GeminiService | null = null;

export function createGeminiService(apiKey: string): GeminiService {
  return new RealGeminiService(apiKey);
}

export function getGeminiService(): GeminiService {
  if (!_serviceInstance) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    _serviceInstance = createGeminiService(apiKey);
  }
  return _serviceInstance;
}

/** Override the service instance (used in tests to inject mocks) */
export function setGeminiService(service: GeminiService): void {
  _serviceInstance = service;
}

export function resetGeminiService(): void {
  _serviceInstance = null;
}


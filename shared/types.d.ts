export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ExplanationStyle = 'beginner' | 'technical';
export type QuestionType = 'multiple-choice' | 'true-false';
export interface Session {
    id: string;
    topic: string;
    createdAt: string;
    updatedAt: string;
    diagnosticComplete: boolean;
    concepts: string[];
    masteryState: MasteryMap;
    history: LearningEvent[];
}
/** Mastery score 0–1 per concept */
export type MasteryMap = Record<string, ConceptMastery>;
export interface ConceptMastery {
    concept: string;
    score: number;
    attempts: number;
    correctAttempts: number;
    lastUpdated: string;
    trend: number[];
}
export interface DiagnosticQuestion {
    id: string;
    concept: string;
    question: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    difficulty: DifficultyLevel;
}
export interface DiagnosticAnswerRequest {
    sessionId: string;
    questionId: string;
    concept: string;
    answer: string;
    correctAnswer: string;
    difficulty: DifficultyLevel;
}
export interface DiagnosticAnswerResponse {
    isCorrect: boolean;
    masteryDelta: number;
    newMastery: number;
    nextQuestion: DiagnosticQuestion | null;
    diagnosticComplete: boolean;
    conceptsEstimated: string[];
}
export interface AdaptiveSelection {
    concept: string;
    difficulty: DifficultyLevel;
    rationale: string;
}
export interface QuizQuestion {
    id: string;
    concept: string;
    question: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    difficulty: DifficultyLevel;
    rationale: string;
}
export interface QuizAnswerRequest {
    sessionId: string;
    questionId: string;
    concept: string;
    answer: string;
    correctAnswer: string;
    difficulty: DifficultyLevel;
}
export interface QuizAnswerResponse {
    isCorrect: boolean;
    feedback: string;
    masteryDelta: number;
    newMastery: number;
    updatedMasteryMap: MasteryMap;
}
export interface ExplanationRequest {
    sessionId: string;
    concept: string;
    style: ExplanationStyle;
}
export interface ExplanationResponse {
    concept: string;
    explanation: string;
    style: ExplanationStyle;
    masteryLevel: number;
    cached: boolean;
}
export type EventType = 'diagnostic_answer' | 'quiz_answer' | 'explanation_viewed';
export interface LearningEvent {
    id: string;
    type: EventType;
    concept: string;
    timestamp: string;
    isCorrect?: boolean;
    masteryBefore?: number;
    masteryAfter?: number;
}
export interface ApiError {
    error: string;
    details?: unknown;
}
export interface SessionCreateRequest {
    topic: string;
}
export interface SessionCreateResponse {
    sessionId: string;
    topic: string;
    firstQuestion: DiagnosticQuestion;
    concepts: string[];
}
export interface MasteryResponse {
    sessionId: string;
    topic: string;
    masteryMap: MasteryMap;
    overallMastery: number;
    weakConcepts: string[];
    strongConcepts: string[];
    recommendedNext: string;
}
//# sourceMappingURL=types.d.ts.map
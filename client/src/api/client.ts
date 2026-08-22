/**
 * api/client.ts
 *
 * Typed API client for all MentorLoop backend endpoints.
 * All AI calls go through the backend — never calls Gemini directly.
 */

import axios from 'axios';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  DiagnosticAnswerRequest,
  DiagnosticAnswerResponse,
  MasteryResponse,
  ExplanationRequest,
  ExplanationResponse,
  QuizQuestion,
  QuizAnswerRequest,
  QuizAnswerResponse,
} from '@shared/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30_000, // 30s for AI calls
  headers: { 'Content-Type': 'application/json' },
});

// ---- Session -----------------------------------------------

export async function createSession(topic: string): Promise<SessionCreateResponse> {
  const body: SessionCreateRequest = { topic };
  const { data } = await api.post<SessionCreateResponse>('/session', body);
  return data;
}

// ---- Diagnostic --------------------------------------------

export async function submitDiagnosticAnswer(
  payload: DiagnosticAnswerRequest & { questionNumber: number }
): Promise<DiagnosticAnswerResponse> {
  const { data } = await api.post<DiagnosticAnswerResponse>('/diagnostic/answer', payload);
  return data;
}

// ---- Mastery -----------------------------------------------

export async function getMastery(sessionId: string): Promise<MasteryResponse> {
  const { data } = await api.get<MasteryResponse>(`/mastery/${sessionId}`);
  return data;
}

// ---- Explain -----------------------------------------------

export async function getExplanation(payload: ExplanationRequest): Promise<ExplanationResponse> {
  const { data } = await api.post<ExplanationResponse>('/explain', payload);
  return data;
}

// ---- Quiz --------------------------------------------------

export async function getNextQuizQuestion(sessionId: string): Promise<QuizQuestion> {
  const { data } = await api.post<QuizQuestion>('/quiz/next', { sessionId });
  return data;
}

export async function submitQuizAnswer(
  payload: QuizAnswerRequest & { question: string }
): Promise<QuizAnswerResponse> {
  const { data } = await api.post<QuizAnswerResponse>('/quiz/answer', payload);
  return data;
}

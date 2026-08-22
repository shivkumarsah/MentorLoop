/**
 * DiagnosticFlow.tsx
 *
 * 5-question adaptive diagnostic flow.
 * Difficulty adjusts based on correctness of previous answers.
 * ARIA live region announces transitions.
 */

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitDiagnosticAnswer } from '../api/client';
import QuestionCard from '../components/QuestionCard';
import FeedbackBanner from '../components/FeedbackBanner';
import Navbar from '../components/Navbar';
import type { DiagnosticQuestion } from '@shared/types';

const TOTAL_QUESTIONS = 5;

export default function DiagnosticFlow(): ReactElement {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('sessionId') ?? '');
  const [topic] = useState(() => sessionStorage.getItem('topic') ?? '');
  const [currentQuestion, setCurrentQuestion] = useState<DiagnosticQuestion | null>(() => {
    const q = sessionStorage.getItem('firstQuestion');
    return q ? (JSON.parse(q) as DiagnosticQuestion) : null;
  });
  const [questionNumber, setQuestionNumber] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; delta: number; newMastery: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: redirect to home if no session
  useEffect(() => {
    if (!sessionId) {
      navigate('/', { replace: true });
    }
  }, [sessionId, navigate]);

  const handleSelectAnswer = useCallback((answer: string) => {
    if (!submitted) setSelectedAnswer(answer);
  }, [submitted]);

  async function handleSubmit(): Promise<void> {
    if (!selectedAnswer || !currentQuestion || submitted) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitDiagnosticAnswer({
        sessionId,
        questionId: currentQuestion.id,
        concept: currentQuestion.concept,
        answer: selectedAnswer,
        correctAnswer: currentQuestion.correctAnswer,
        difficulty: currentQuestion.difficulty,
        questionNumber,
      });

      setSubmitted(true);
      setFeedback({
        isCorrect: result.isCorrect,
        delta: result.masteryDelta,
        newMastery: result.newMastery,
      });

      if (result.diagnosticComplete) {
        // Navigate to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2500);
      } else if (result.nextQuestion) {
        // After feedback pause, move to next question
        setTimeout(() => {
          setCurrentQuestion(result.nextQuestion);
          setQuestionNumber((n) => n + 1);
          setSelectedAnswer(null);
          setSubmitted(false);
          setFeedback(null);
        }, 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer.');
    } finally {
      setLoading(false);
    }
  }

  if (!currentQuestion) {
    return (
      <main className="page" style={{ justifyContent: 'center' }}>
        <div className="spinner" aria-label="Loading question..." />
        <p className="text-muted mt-4" role="status">Loading your first question...</p>
      </main>
    );
  }

  const progressPct = ((questionNumber - 1) / TOTAL_QUESTIONS) * 100;

  return (
    <main className="page" style={{ justifyContent: 'flex-start', paddingTop: '100px' }}>
      <Navbar topic={topic} badgeText="Diagnostic" />

      <div className="container" style={{ maxWidth: '680px' }}>
        {/* Progress header */}
        <header style={{ marginBottom: 'var(--space-8)' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
            <h1 style={{ fontSize: '1.375rem' }}>Knowledge Diagnostic</h1>
            <span className="text-sm text-muted" aria-live="polite">
              {questionNumber} / {TOTAL_QUESTIONS}
            </span>
          </div>

          {/* Overall progress bar */}
          <div
            role="progressbar"
            aria-valuenow={questionNumber - 1}
            aria-valuemin={0}
            aria-valuemax={TOTAL_QUESTIONS}
            aria-label={`Diagnostic progress: question ${questionNumber} of ${TOTAL_QUESTIONS}`}
            className="progress-track"
          >
            <div
              className="progress-fill"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--color-brand-from), var(--color-brand-to))',
                transition: 'width 0.6s ease',
              }}
            />
          </div>

          <p
            className="text-sm text-muted"
            style={{ marginTop: 'var(--space-2)' }}
          >
            Estimating your starting knowledge level — difficulty adapts to your answers.
          </p>
        </header>

        {/* Question */}
        <div className="animate-fade-in-up" key={currentQuestion.id}>
          <QuestionCard
            question={currentQuestion.question}
            options={currentQuestion.options}
            selectedAnswer={selectedAnswer}
            correctAnswer={submitted ? currentQuestion.correctAnswer : null}
            onSelectAnswer={handleSelectAnswer}
            submitted={submitted}
            difficulty={currentQuestion.difficulty}
            questionNumber={questionNumber}
            totalQuestions={TOTAL_QUESTIONS}
          />
        </div>

        {/* Feedback */}
        <div style={{ marginTop: 'var(--space-5)' }}>
          <FeedbackBanner
            isCorrect={feedback?.isCorrect ?? false}
            message={
              feedback?.isCorrect
                ? `Your mastery for "${currentQuestion.concept}" increased to ${((feedback.newMastery) * 100).toFixed(0)}%.`
                : `The correct answer was: ${currentQuestion.correctAnswer}`
            }
            masteryDelta={feedback?.delta}
            visible={!!feedback}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              background: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              color: 'var(--color-error)',
              fontSize: '0.875rem',
              marginTop: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit button */}
        {!submitted && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <button
              id="submit-answer-btn"
              type="button"
              className="btn btn-primary w-full"
              onClick={handleSubmit}
              disabled={!selectedAnswer || loading}
              aria-busy={loading}
              style={{ fontSize: '1rem', padding: 'var(--space-4)' }}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Checking answer...
                </>
              ) : (
                'Submit Answer →'
              )}
            </button>
          </div>
        )}

        {submitted && feedback && (
          <p
            aria-live="polite"
            className="text-sm text-muted text-center"
            style={{ marginTop: 'var(--space-4)' }}
          >
            {questionNumber >= TOTAL_QUESTIONS
              ? '✅ Diagnostic complete! Redirecting to your dashboard...'
              : 'Next question loading...'}
          </p>
        )}
      </div>
    </main>
  );
}

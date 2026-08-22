/**
 * QuizFlow.tsx
 *
 * Adaptive quiz flow — fetches next question from backend (which uses BKT selection),
 * submits answers, shows Gemini-powered feedback, and updates mastery.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextQuizQuestion, submitQuizAnswer } from '../api/client';
import QuestionCard from '../components/QuestionCard';
import FeedbackBanner from '../components/FeedbackBanner';
import MasteryBar from '../components/MasteryBar';
import Navbar from '../components/Navbar';
import type { QuizQuestion, MasteryMap } from '@shared/types';

const QUIZ_LENGTH = 8;

export default function QuizFlow(): JSX.Element {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('sessionId') ?? '');
  const [topic] = useState(() => sessionStorage.getItem('topic') ?? '');

  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    message: string;
    delta: number;
    newMastery: number;
  } | null>(null);
  const [masteryMap, setMasteryMap] = useState<MasteryMap | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizComplete, setQuizComplete] = useState(false);

  useEffect(() => {
    if (!sessionId) { navigate('/', { replace: true }); return; }
    fetchNextQuestion();
  }, [sessionId]);

  const fetchNextQuestion = useCallback(async (): Promise<void> => {
    setLoadingQuestion(true);
    setError(null);
    try {
      const q = await getNextQuizQuestion(sessionId);
      setCurrentQuestion(q);
      setSelectedAnswer(null);
      setSubmitted(false);
      setFeedback(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question.');
    } finally {
      setLoadingQuestion(false);
    }
  }, [sessionId]);

  async function handleSubmit(): Promise<void> {
    if (!selectedAnswer || !currentQuestion || submitted) return;

    setLoadingSubmit(true);
    setError(null);

    try {
      const result = await submitQuizAnswer({
        sessionId,
        questionId: currentQuestion.id,
        concept: currentQuestion.concept,
        answer: selectedAnswer,
        correctAnswer: currentQuestion.correctAnswer,
        difficulty: currentQuestion.difficulty,
        question: currentQuestion.question,
      });

      setSubmitted(true);
      setFeedback({
        isCorrect: result.isCorrect,
        message: result.feedback,
        delta: result.masteryDelta,
        newMastery: result.newMastery,
      });
      setMasteryMap(result.updatedMasteryMap);
      setScore((s) => ({
        correct: s.correct + (result.isCorrect ? 1 : 0),
        total: s.total + 1,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer.');
    } finally {
      setLoadingSubmit(false);
    }
  }

  function handleNext(): void {
    if (questionNumber >= QUIZ_LENGTH) {
      setQuizComplete(true);
    } else {
      setQuestionNumber((n) => n + 1);
      fetchNextQuestion();
    }
  }

  // ---- Quiz Complete screen --------------------------------
  if (quizComplete) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <main className="page" style={{ justifyContent: 'center' }}>
        <Navbar />

        <div className="container animate-fade-in-up" style={{ maxWidth: '560px', paddingTop: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }} aria-hidden="true">
            {pct >= 80 ? '🏆' : pct >= 50 ? '📈' : '💪'}
          </div>

          <h1 style={{ marginBottom: 'var(--space-3)' }}>Quiz Complete!</h1>

          <p className="text-secondary" style={{ marginBottom: 'var(--space-8)' }}>
            You answered{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{score.correct} of {score.total}</strong>
            {' '}questions correctly ({pct}%)
          </p>

          {masteryMap && (
            <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', textAlign: 'left' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)' }}>Updated Mastery</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {Object.values(masteryMap).map((cm) => (
                  <MasteryBar key={cm.concept} concept={cm.concept} score={cm.score} />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/dashboard')}
            >
              📊 View Dashboard
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setQuizComplete(false);
                setQuestionNumber(1);
                setScore({ correct: 0, total: 0 });
                fetchNextQuestion();
              }}
            >
              🔄 Another Round
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- Main quiz UI ----------------------------------------
  const progressPct = ((questionNumber - 1) / QUIZ_LENGTH) * 100;

  return (
    <main className="page" style={{ justifyContent: 'flex-start', paddingTop: '100px' }}>
      <Navbar
        scoreText={`✓ ${score.correct}/${score.total}`}
        showDashboardButton
      />

      <div className="container" style={{ maxWidth: '680px' }}>
        {/* Progress */}
        <header style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
            <h1 style={{ fontSize: '1.25rem' }}>
              Adaptive Quiz · <span className="text-muted">{topic}</span>
            </h1>
            <span className="text-sm text-muted" aria-live="polite">
              {questionNumber} / {QUIZ_LENGTH}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={questionNumber - 1}
            aria-valuemin={0}
            aria-valuemax={QUIZ_LENGTH}
            aria-label={`Quiz progress: question ${questionNumber} of ${QUIZ_LENGTH}`}
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
        </header>

        {/* Loading state */}
        {loadingQuestion ? (
          <div className="glass-card flex flex-col items-center" style={{ padding: 'var(--space-12)', gap: 'var(--space-4)' }}>
            <div className="spinner" style={{ width: 40, height: 40 }} aria-label="Loading question..." />
            <p className="text-muted" role="status">Selecting the best question for your current mastery...</p>
          </div>
        ) : currentQuestion ? (
          <div className="animate-fade-in" key={currentQuestion.id}>
            <QuestionCard
              question={currentQuestion.question}
              options={currentQuestion.options}
              selectedAnswer={selectedAnswer}
              correctAnswer={submitted ? currentQuestion.correctAnswer : null}
              onSelectAnswer={(a) => !submitted && setSelectedAnswer(a)}
              submitted={submitted}
              difficulty={currentQuestion.difficulty}
              questionNumber={questionNumber}
              totalQuestions={QUIZ_LENGTH}
              rationale={currentQuestion.rationale}
            />
          </div>
        ) : null}

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
              marginTop: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div style={{ marginTop: 'var(--space-5)' }}>
            <FeedbackBanner
              isCorrect={feedback.isCorrect}
              message={feedback.message}
              masteryDelta={feedback.delta}
              visible
            />
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 'var(--space-5)' }}>
          {!submitted ? (
            <button
              id="submit-quiz-answer-btn"
              type="button"
              className="btn btn-primary w-full"
              onClick={handleSubmit}
              disabled={!selectedAnswer || loadingSubmit || loadingQuestion}
              aria-busy={loadingSubmit}
              style={{ fontSize: '1rem', padding: 'var(--space-4)' }}
            >
              {loadingSubmit ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Checking answer...
                </>
              ) : (
                'Submit Answer →'
              )}
            </button>
          ) : (
            <button
              id="next-question-btn"
              type="button"
              className="btn btn-primary w-full"
              onClick={handleNext}
              style={{ fontSize: '1rem', padding: 'var(--space-4)' }}
            >
              {questionNumber >= QUIZ_LENGTH ? '🏁 See Results' : 'Next Question →'}
            </button>
          )}
        </div>

        {/* Concept tag */}
        {currentQuestion && !loadingQuestion && (
          <p className="text-xs text-muted text-center" style={{ marginTop: 'var(--space-3)' }}>
            Testing concept:{' '}
            <strong style={{ color: 'var(--color-text-secondary)' }}>
              {currentQuestion.concept}
            </strong>
          </p>
        )}
      </div>
    </main>
  );
}

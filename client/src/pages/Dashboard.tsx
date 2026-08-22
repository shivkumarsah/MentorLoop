/**
 * Dashboard.tsx
 *
 * Mastery overview dashboard — per-concept progress bars, trend info,
 * recommended next action, navigation to explain/quiz.
 */

import { useState, useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMastery } from '../api/client';
import MasteryBar from '../components/MasteryBar';
import Navbar from '../components/Navbar';
import type { MasteryResponse } from '@shared/types';

export default function Dashboard(): ReactElement {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('sessionId') ?? '');
  const [topic] = useState(() => sessionStorage.getItem('topic') ?? '');
  const [mastery, setMastery] = useState<MasteryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { navigate('/', { replace: true }); return; }
    loadMastery();
  }, [sessionId]);

  async function loadMastery(): Promise<void> {
    try {
      const data = await getMastery(sessionId);
      setMastery(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mastery data.');
    } finally {
      setLoading(false);
    }
  }

  function handleExplain(concept: string): void {
    sessionStorage.setItem('explainConcept', concept);
    navigate('/explain');
  }

  function handleStartQuiz(): void {
    navigate('/quiz');
  }

  const overallPct = mastery ? Math.round(mastery.overallMastery * 100) : 0;

  return (
    <main className="page" style={{ justifyContent: 'flex-start', paddingTop: '100px' }}>
      <Navbar topic={topic} showNewTopicButton />

      <div className="container" style={{ maxWidth: '780px' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center" style={{ gap: 'var(--space-4)', paddingTop: 'var(--space-16)' }}>
            <div className="spinner" style={{ width: 48, height: 48 }} aria-label="Loading dashboard..." />
            <p className="text-muted" role="status">Loading your progress...</p>
          </div>
        ) : error ? (
          <div role="alert" style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', color: 'var(--color-error)' }}>
            {error}
          </div>
        ) : mastery ? (
          <div className="animate-fade-in-up">
            {/* Header */}
            <header style={{ marginBottom: 'var(--space-8)' }}>
              <h1 style={{ marginBottom: 'var(--space-2)' }}>
                Your Learning Dashboard
              </h1>
              <p className="text-secondary">
                Topic: <strong style={{ color: 'var(--color-text-primary)' }}>{topic}</strong>
                {' '}· {Object.keys(mastery.masteryMap).length} concepts tracked
              </p>
            </header>

            {/* Overall mastery card */}
            <div
              className="glass-card"
              style={{
                padding: 'var(--space-8)',
                marginBottom: 'var(--space-6)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.05))',
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-1)' }}>Overall Mastery</h2>
                  <p className="text-sm text-muted">Across all concepts</p>
                </div>
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-heading)',
                    background: 'linear-gradient(135deg, #c4b5fd, #67e8f9)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                  aria-label={`Overall mastery: ${overallPct}%`}
                >
                  {overallPct}%
                </div>
              </div>

              <MasteryBar
                concept="Overall"
                score={mastery.overallMastery}
                showLabel={false}
                size="lg"
              />

              {/* Summary stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-4)',
                  marginTop: 'var(--space-6)',
                }}
              >
                {[
                  { label: 'Mastered', value: mastery.strongConcepts.length, color: 'var(--color-success)' },
                  { label: 'In Progress', value: mastery.weakConcepts.length, color: 'var(--color-warning)' },
                  { label: 'Concepts Total', value: Object.keys(mastery.masteryMap).length, color: 'var(--color-brand-mid)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-8)',
              }}
            >
              <button
                id="start-quiz-btn"
                type="button"
                className="btn btn-primary"
                onClick={handleStartQuiz}
                style={{ padding: 'var(--space-4)', fontSize: '1rem' }}
              >
                🎯 Start Adaptive Quiz
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleExplain(mastery.recommendedNext)}
                style={{ padding: 'var(--space-4)', fontSize: '1rem' }}
              >
                💡 Explain: {mastery.recommendedNext}
              </button>
            </div>

            {/* Recommended next */}
            {mastery.recommendedNext && (
              <div
                className="glass-card"
                style={{
                  padding: 'var(--space-5)',
                  marginBottom: 'var(--space-6)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}
              >
                <span style={{ fontSize: '1.5rem' }} aria-hidden="true">🎯</span>
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', fontWeight: 600, margin: 0 }}>
                    Recommended Next
                  </p>
                  <p style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                    Focus on <strong>{mastery.recommendedNext}</strong> — it has the most room for improvement.
                  </p>
                </div>
              </div>
            )}

            {/* Per-concept mastery */}
            <section aria-labelledby="concepts-heading">
              <h2 id="concepts-heading" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-5)' }}>
                Concept Breakdown
              </h2>

              <div
                className="glass-card"
                style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
              >
                {Object.values(mastery.masteryMap)
                  .sort((a, b) => a.score - b.score)
                  .map((cm) => (
                    <div key={cm.concept}>
                      <MasteryBar concept={cm.concept} score={cm.score} />
                      <div
                        className="flex justify-between"
                        style={{ marginTop: 'var(--space-2)' }}
                      >
                        <span className="text-xs text-muted">
                          {cm.attempts} attempt{cm.attempts !== 1 ? 's' : ''} ·{' '}
                          {cm.attempts > 0
                            ? `${Math.round((cm.correctAttempts / cm.attempts) * 100)}% accuracy`
                            : 'not yet attempted'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExplain(cm.concept)}
                            aria-label={`Get explanation for ${cm.concept}`}
                          >
                            💡 Explain
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* Refresh button */}
            <div className="text-center" style={{ marginTop: 'var(--space-8)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadMastery}
              >
                ↻ Refresh Progress
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

/**
 * ExplainView.tsx
 *
 * Mastery-adapted AI explanation panel.
 * Learner can toggle between "beginner" and "technical" style.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExplanation, getMastery } from '../api/client';
import MasteryBar from '../components/MasteryBar';
import Navbar from '../components/Navbar';
import type { ExplanationStyle } from '@shared/types';

export default function ExplainView(): JSX.Element {
  const navigate = useNavigate();
  const [sessionId] = useState(() => sessionStorage.getItem('sessionId') ?? '');
  const [topic] = useState(() => sessionStorage.getItem('topic') ?? '');
  const [concept] = useState(() => sessionStorage.getItem('explainConcept') ?? '');

  const [style, setStyle] = useState<ExplanationStyle>('beginner');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [masteryScore, setMasteryScore] = useState<number>(0.1);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !concept) { navigate('/', { replace: true }); return; }
    loadExplanation();
    loadMastery();
  }, [sessionId, concept]);

  async function loadMastery(): Promise<void> {
    try {
      const mastery = await getMastery(sessionId);
      const cm = mastery.masteryMap[concept];
      if (cm) setMasteryScore(cm.score);
    } catch {
      // non-fatal
    }
  }

  async function loadExplanation(newStyle?: ExplanationStyle): Promise<void> {
    setLoading(true);
    setError(null);
    const activeStyle = newStyle ?? style;
    try {
      const data = await getExplanation({ sessionId, concept, style: activeStyle });
      setExplanation(data.explanation);
      setCached(data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load explanation.');
    } finally {
      setLoading(false);
    }
  }

  function handleStyleSwitch(newStyle: ExplanationStyle): void {
    if (newStyle === style) return;
    setStyle(newStyle);
    loadExplanation(newStyle);
  }

  return (
    <main className="page" style={{ justifyContent: 'flex-start', paddingTop: '100px' }}>
      <Navbar showDashboardButton />

      <div className="container animate-fade-in-up" style={{ maxWidth: '760px' }}>
        {/* Header */}
        <header style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.5rem' }} aria-hidden="true">💡</span>
            <span className="badge badge-brand">{topic}</span>
          </div>
          <h1 style={{ marginBottom: 'var(--space-3)' }}>{concept}</h1>

          {/* Mastery for this concept */}
          <div style={{ maxWidth: '360px' }}>
            <MasteryBar concept="Your Mastery" score={masteryScore} size="sm" />
          </div>
        </header>

        {/* Style toggle */}
        <div
          role="group"
          aria-label="Explanation style"
          style={{
            display: 'inline-flex',
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            padding: '3px',
            marginBottom: 'var(--space-6)',
          }}
        >
          {(['beginner', 'technical'] as ExplanationStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              id={`style-${s}`}
              onClick={() => handleStyleSwitch(s)}
              aria-pressed={style === s}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
                background: style === s
                  ? 'linear-gradient(135deg, var(--color-brand-from), var(--color-brand-to))'
                  : 'transparent',
                color: style === s ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {s === 'beginner' ? '🌱 Beginner' : '⚙️ Technical'}
            </button>
          ))}
        </div>

        {/* Explanation card */}
        <div className="glass-card" style={{ padding: 'var(--space-8)' }}>
          {loading ? (
            <div className="flex flex-col items-center" style={{ gap: 'var(--space-4)', padding: 'var(--space-8) 0' }}>
              <div className="spinner" style={{ width: 40, height: 40 }} aria-label="Generating explanation..." />
              <p className="text-muted" role="status">
                Generating a {style} explanation adapted to your mastery level...
              </p>
            </div>
          ) : error ? (
            <div role="alert" style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              {error}
            </div>
          ) : explanation ? (
            <>
              {cached && (
                <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>⚡ Cached</span>
                  <span className="text-xs text-muted">Retrieved instantly from session cache</span>
                </div>
              )}

              <div
                aria-label={`Explanation for ${concept}`}
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem',
                  lineHeight: 1.85,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {explanation}
              </div>

              <div
                style={{
                  marginTop: 'var(--space-8)',
                  paddingTop: 'var(--space-6)',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('/quiz')}
                >
                  🎯 Test Your Understanding
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/dashboard')}
                >
                  📊 Back to Dashboard
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* AI attribution */}
        <p className="text-xs text-muted text-center" style={{ marginTop: 'var(--space-5)' }}>
          ✨ Explanation generated by Google Gemini AI · adapted to {style} level (mastery: {Math.round(masteryScore * 100)}%)
        </p>
      </div>
    </main>
  );
}

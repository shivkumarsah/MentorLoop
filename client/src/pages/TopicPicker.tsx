/**
 * TopicPicker.tsx
 *
 * Landing page — user enters a topic, starts a session, navigates to diagnostic.
 * Accessible: labeled form input, semantic button, keyboard-navigable.
 */

import { useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api/client';
import Navbar from '../components/Navbar';

const EXAMPLE_TOPICS = [
  'Python basics',
  'Photosynthesis',
  'World War II causes',
  'JavaScript promises',
  'Quantum mechanics',
  'Ancient Rome',
  'Machine learning fundamentals',
  'Climate science',
];

export default function TopicPicker(): ReactElement {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleStart(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const session = await createSession(topic.trim());

      // Persist session data for other pages
      sessionStorage.setItem('sessionId', session.sessionId);
      sessionStorage.setItem('topic', session.topic);
      sessionStorage.setItem('concepts', JSON.stringify(session.concepts));
      sessionStorage.setItem('firstQuestion', JSON.stringify(session.firstQuestion));

      navigate('/diagnostic');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start session. Make sure the server is running and your Gemini API key is set.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleTopicChip(example: string): void {
    setTopic(example);
  }

  return (
    <main className="page" style={{ justifyContent: 'center' }}>
      <Navbar badgeText="AI-Powered Learning" />

      <div
        className="container animate-fade-in-up"
        style={{ paddingTop: '80px', maxWidth: '680px' }}
      >
        {/* Hero */}
        <header className="text-center" style={{ marginBottom: 'var(--space-12)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <img
              src="/mentorloop-logo.svg"
              alt="MentorLoop"
              style={{ width: '280px', height: 'auto', margin: '0 auto', display: 'block' }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <span className="badge badge-brand">✨ Powered by Gemini AI</span>
          </div>

          <h1 style={{ marginBottom: 'var(--space-4)' }}>
            Learn anything,{' '}
            <span className="text-gradient">at your level</span>
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--color-text-secondary)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            MentorLoop runs a quick diagnostic, maps your knowledge, then generates
            personalized explanations and quizzes — adapting in real time as you learn.
          </p>
        </header>

        {/* Topic input card */}
        <div
          className="glass-card animate-fade-in-up"
          style={{
            padding: 'var(--space-10)',
            animationDelay: '100ms',
          }}
        >
          <form onSubmit={handleStart} noValidate>
            <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="topic-input" className="form-label" style={{ fontSize: '1rem' }}>
                What do you want to learn today?
              </label>

              <input
                id="topic-input"
                type="text"
                className="form-input"
                placeholder="e.g. Python basics, Photosynthesis, World War II..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
                autoComplete="off"
                maxLength={200}
                aria-describedby="topic-hint"
                style={{ fontSize: '1.0625rem', padding: 'var(--space-5)' }}
              />

              <span id="topic-hint" className="text-xs text-muted">
                Any subject — history, science, coding, math, literature, and more.
              </span>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  marginBottom: 'var(--space-5)',
                  color: 'var(--color-error)',
                  fontSize: '0.875rem',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              id="start-btn"
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !topic.trim()}
              style={{ fontSize: '1rem', padding: 'var(--space-4) var(--space-6)' }}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Generating your personalized curriculum...</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">🚀</span>
                  Start Learning
                </>
              )}
            </button>
          </form>
        </div>

        {/* Example topic chips */}
        <section
          style={{ marginTop: 'var(--space-8)' }}
          aria-label="Example topics"
        >
          <p className="text-sm text-muted text-center" style={{ marginBottom: 'var(--space-4)' }}>
            Try one of these:
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              justifyContent: 'center',
            }}
          >
            {EXAMPLE_TOPICS.map((example) => (
              <button
                key={example}
                type="button"
                className="concept-chip"
                onClick={() => handleTopicChip(example)}
                aria-label={`Use topic: ${example}`}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {/* Feature highlights */}
        <section
          aria-label="Key features"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-12)',
          }}
        >
          {[
            { icon: '🎯', title: 'Adaptive Diagnostic', desc: 'Finds your exact knowledge level' },
            { icon: '🧬', title: 'Knowledge Tracing', desc: 'Bayesian model tracks mastery' },
            { icon: '💡', title: 'AI Explanations', desc: 'Gemini adapts depth to your level' },
            { icon: '📈', title: 'Live Dashboard', desc: 'Track progress per concept' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="glass-card"
              style={{ padding: 'var(--space-5)', textAlign: 'center' }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }} aria-hidden="true">
                {icon}
              </div>
              <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-1)' }}>{title}</h3>
              <p style={{ fontSize: '0.8rem' }}>{desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

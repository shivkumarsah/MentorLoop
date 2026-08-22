/**
 * QuestionCard.tsx
 *
 * Accessible question card with keyboard-navigable answer options.
 * Uses <button> elements (not div onClick) for full keyboard support.
 */

import type { DifficultyLevel } from '@shared/types';

interface QuestionCardProps {
  question: string;
  options: string[];
  selectedAnswer: string | null;
  correctAnswer?: string | null; // shown after submission
  onSelectAnswer: (answer: string) => void;
  submitted: boolean;
  difficulty?: DifficultyLevel;
  questionNumber?: number;
  totalQuestions?: number;
  rationale?: string;
}

export default function QuestionCard({
  question,
  options,
  selectedAnswer,
  correctAnswer,
  onSelectAnswer,
  submitted,
  difficulty,
  questionNumber,
  totalQuestions,
  rationale,
}: QuestionCardProps): JSX.Element {
  function getOptionState(option: string): 'default' | 'selected' | 'correct' | 'wrong' | 'missed' {
    if (!submitted) {
      return selectedAnswer === option ? 'selected' : 'default';
    }
    if (option === correctAnswer) return 'correct';
    if (option === selectedAnswer && option !== correctAnswer) return 'wrong';
    return 'default';
  }

  const optionStyles: Record<ReturnType<typeof getOptionState>, React.CSSProperties> = {
    default: {
      background: 'var(--color-bg-glass)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)',
    },
    selected: {
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.5)',
      color: 'var(--color-text-primary)',
    },
    correct: {
      background: 'var(--color-success-bg)',
      border: '1px solid var(--color-success-border)',
      color: 'var(--color-success)',
    },
    wrong: {
      background: 'var(--color-error-bg)',
      border: '1px solid var(--color-error-border)',
      color: 'var(--color-error)',
    },
    missed: {
      background: 'var(--color-bg-glass)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-muted)',
    },
  };

  const optionIcons: Partial<Record<ReturnType<typeof getOptionState>, string>> = {
    correct: '✓',
    wrong: '✗',
    selected: '◎',
  };

  return (
    <div className="glass-card" style={{ padding: 'var(--space-8)', width: '100%' }}>
      {/* Header row */}
      {(questionNumber !== undefined || difficulty) && (
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 'var(--space-6)' }}
        >
          {questionNumber !== undefined && totalQuestions !== undefined && (
            <span className="text-sm text-muted">
              Question {questionNumber} of {totalQuestions}
            </span>
          )}
          {difficulty && (
            <span className={`badge badge-${difficulty}`}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          )}
        </div>
      )}

      {/* Question text */}
      <h2
        id="question-heading"
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          lineHeight: 1.5,
          marginBottom: 'var(--space-6)',
          color: 'var(--color-text-primary)',
        }}
      >
        {question}
      </h2>

      {/* Answer options */}
      <fieldset
        aria-labelledby="question-heading"
        style={{ border: 'none', padding: 0, margin: 0 }}
      >
        <legend className="sr-only">Select your answer</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {options.map((option, idx) => {
            const state = getOptionState(option);
            const isSelected = selectedAnswer === option;
            const icon = optionIcons[state];

            return (
              <button
                key={idx}
                type="button"
                onClick={() => !submitted && onSelectAnswer(option)}
                disabled={submitted}
                aria-pressed={isSelected}
                aria-label={`Option ${String.fromCharCode(65 + idx)}: ${option}${state === 'correct' ? ' (correct)' : state === 'wrong' ? ' (incorrect)' : ''}`}
                style={{
                  ...optionStyles[state],
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4) var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  cursor: submitted ? 'default' : 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  fontWeight: isSelected ? 500 : 400,
                  transition: 'all var(--transition-fast)',
                  lineHeight: 1.5,
                }}
              >
                {/* Option letter */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {icon ?? String.fromCharCode(65 + idx)}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Rationale (adaptive selection explanation) */}
      {rationale && (
        <details style={{ marginTop: 'var(--space-5)' }}>
          <summary
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            🔍 Why this question?
          </summary>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              marginTop: 'var(--space-2)',
              paddingLeft: 'var(--space-4)',
              borderLeft: '2px solid var(--color-border)',
              fontStyle: 'italic',
            }}
          >
            {rationale}
          </p>
        </details>
      )}
    </div>
  );
}

// Screen reader only utility (inline since we can't import from CSS in components directly)
declare global {
  interface CSSProperties {
    WebkitBackgroundClip?: string;
    WebkitTextFillColor?: string;
  }
}

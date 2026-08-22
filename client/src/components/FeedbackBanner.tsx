import type { ReactElement } from 'react';

interface FeedbackBannerProps {
  isCorrect: boolean;
  message: string;
  masteryDelta?: number;
  visible: boolean;
}

export default function FeedbackBanner({
  isCorrect,
  message,
  masteryDelta,
  visible,
}: FeedbackBannerProps): ReactElement {
  if (!visible) {
    // Still render (for layout stability) but hidden from sighted users
    // The live region is always present so screen readers can detect changes
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      />
    );
  }

  const bgStyle = isCorrect
    ? { background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }
    : { background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' };

  const textColor = isCorrect ? 'var(--color-success)' : 'var(--color-error)';
  const icon = isCorrect ? '✓' : '✗';
  const headingText = isCorrect ? 'Correct!' : 'Not quite.';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="animate-fade-in"
      style={{
        ...bgStyle,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5) var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        {/* Icon + label (not color alone) */}
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: textColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>

        <div style={{ flex: 1 }}>
          <p
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: '1rem',
              margin: 0,
            }}
          >
            {headingText}
            {masteryDelta !== undefined && (
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  marginLeft: '8px',
                  opacity: 0.8,
                }}
              >
                {masteryDelta > 0 ? `+${(masteryDelta * 100).toFixed(1)}%` : `${(masteryDelta * 100).toFixed(1)}%`} mastery
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Explanation text */}
      <p
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          margin: 0,
          paddingLeft: '44px', // align with icon
        }}
      >
        {message}
      </p>
    </div>
  );
}

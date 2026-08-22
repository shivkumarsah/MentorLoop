/**
 * MasteryBar.tsx
 *
 * Accessible mastery progress bar with animated fill.
 * Uses ARIA attributes so screen readers can announce the value.
 */

interface MasteryBarProps {
  concept: string;
  score: number; // 0–1
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

function getMasteryClass(score: number): string {
  if (score < 0.3) return 'progress-fill-low';
  if (score < 0.7) return 'progress-fill-mid';
  return 'progress-fill-high';
}

function getMasteryLabel(score: number): string {
  if (score < 0.3) return 'Beginner';
  if (score < 0.5) return 'Developing';
  if (score < 0.7) return 'Intermediate';
  if (score < 0.9) return 'Proficient';
  return 'Mastered';
}

const SIZE_HEIGHTS: Record<NonNullable<MasteryBarProps['size']>, string> = {
  sm: '6px',
  md: '8px',
  lg: '12px',
};

export default function MasteryBar({
  concept,
  score,
  showLabel = true,
  size = 'md',
  animate = true,
}: MasteryBarProps): JSX.Element {
  const pct = Math.round(score * 100);
  const fillClass = getMasteryClass(score);
  const label = getMasteryLabel(score);

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: '6px' }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            {concept}
          </span>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                color:
                  score < 0.3
                    ? 'var(--color-mastery-low)'
                    : score < 0.7
                    ? 'var(--color-mastery-mid)'
                    : 'var(--color-mastery-high)',
                fontWeight: 600,
              }}
            >
              {pct}%
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>· {label}</span>
          </span>
        </div>
      )}

      {/* Accessible progress bar */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${concept} mastery: ${pct}% — ${label}`}
        className="progress-track"
        style={{ height: SIZE_HEIGHTS[size] }}
      >
        <div
          className={`progress-fill ${fillClass}`}
          style={{
            width: `${pct}%`,
            transition: animate ? 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        />
      </div>
    </div>
  );
}

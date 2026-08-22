import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface NavbarProps {
  topic?: string;
  badgeText?: string;
  showNewTopicButton?: boolean;
  showDashboardButton?: boolean;
  scoreText?: string;
}

export default function Navbar({
  topic,
  badgeText,
  showNewTopicButton = false,
  showDashboardButton = false,
  scoreText,
}: NavbarProps): ReactElement {
  const navigate = useNavigate();

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textDecoration: 'none',
        }}
      >
        <img
          src="/mentorloop-icon.svg"
          alt="MentorLoop Logo"
          style={{ width: '34px', height: '34px', borderRadius: '8px' }}
        />
        <span
          className="text-gradient"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          MentorLoop
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {scoreText && <span className="text-sm text-muted">{scoreText}</span>}
        {topic && <span className="text-sm text-muted">{topic}</span>}
        {badgeText && <span className="badge badge-brand">{badgeText}</span>}

        {showDashboardButton && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/dashboard')}
          >
            📊 Dashboard
          </button>
        )}

        {showNewTopicButton && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/')}
          >
            New Topic
          </button>
        )}
      </div>
    </nav>
  );
}

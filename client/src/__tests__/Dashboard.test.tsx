import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import * as clientApi from '../api/client';

vi.mock('../api/client');

describe('Dashboard Page', () => {
  beforeEach(() => {
    sessionStorage.setItem('sessionId', 'test-session-1');
    sessionStorage.setItem('topic', 'Python basics');
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(clientApi, 'getMastery').mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/Loading your progress/i)).toBeInTheDocument();
  });

  it('renders overall mastery score and concept breakdown after load', async () => {
    vi.spyOn(clientApi, 'getMastery').mockResolvedValueOnce({
      sessionId: 'test-session-1',
      topic: 'Python basics',
      overallMastery: 0.65,
      masteryMap: {
        Variables: {
          concept: 'Variables',
          score: 0.8,
          attempts: 2,
          correctAttempts: 2,
          lastUpdated: new Date().toISOString(),
          trend: [0.5, 0.8],
        },
        Loops: {
          concept: 'Loops',
          score: 0.4,
          attempts: 2,
          correctAttempts: 1,
          lastUpdated: new Date().toISOString(),
          trend: [0.5, 0.4],
        },
      },
      weakConcepts: ['Loops'],
      strongConcepts: ['Variables'],
      recommendedNext: 'quiz',
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Overall Mastery')).toBeInTheDocument();
      expect(screen.getByText('Loops')).toBeInTheDocument();
      expect(screen.getByText('Variables')).toBeInTheDocument();
    });
  });
});

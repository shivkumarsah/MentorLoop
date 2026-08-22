import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExplainView from '../pages/ExplainView';
import * as clientApi from '../api/client';

vi.mock('../api/client');

describe('ExplainView Page', () => {
  beforeEach(() => {
    sessionStorage.setItem('sessionId', 'test-session-1');
    sessionStorage.setItem('topic', 'Python basics');
    sessionStorage.setItem('explainConcept', 'Variables');
    vi.clearAllMocks();
  });

  it('renders explanation content and style buttons', async () => {
    vi.spyOn(clientApi, 'getMastery').mockResolvedValueOnce({
      sessionId: 'test-session-1',
      topic: 'Python basics',
      overallMastery: 0.5,
      masteryMap: {
        'Variables': { score: 0.5, history: [] },
      },
      weakConcepts: [],
      strongConcepts: [],
      lastUpdated: new Date().toISOString(),
    });

    vi.spyOn(clientApi, 'getExplanation').mockResolvedValueOnce({
      concept: 'Variables',
      explanation: 'A variable is a labeled container for data values.',
      cached: false,
    });

    render(
      <MemoryRouter>
        <ExplainView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Variables' })).toBeInTheDocument();
      expect(
        screen.getByText('A variable is a labeled container for data values.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Beginner/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Technical/i })).toBeInTheDocument();
    });
  });
});

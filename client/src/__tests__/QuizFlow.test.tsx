/**
 * QuizFlow.test.tsx
 *
 * Component tests for QuizFlow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuizFlow from '../pages/QuizFlow';
import * as apiClient from '../api/client';

// ---- Mocks ------------------------------------------------

vi.mock('../api/client', () => ({
  getNextQuizQuestion: vi.fn(),
  submitQuizAnswer: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockQuestion = {
  id: 'q-test-1',
  type: 'multiple-choice' as const,
  concept: 'Variables',
  question: 'What is a variable in Python?',
  options: [
    'A) A container for storing data',
    'B) A type of loop',
    'C) A function definition',
    'D) A module import',
  ],
  correctAnswer: 'A) A container for storing data',
  difficulty: 'easy' as const,
  rationale: 'selected because Variables mastery=0.10 is below threshold 0.70',
};

const mockSessionStorage: Record<string, string> = {
  sessionId: 'test-session-uuid',
  topic: 'Python Basics',
};

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockSessionStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockSessionStorage[key] = val; },
    removeItem: (key: string) => { delete mockSessionStorage[key]; },
    clear: () => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); },
  },
  writable: true,
});

function renderComponent(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <QuizFlow />
    </MemoryRouter>
  );
}

describe('QuizFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getNextQuizQuestion).mockResolvedValue(mockQuestion);
  });

  // ---- Initial render --------------------------------------

  it('shows a loading spinner while fetching the first question', () => {
    vi.mocked(apiClient.getNextQuizQuestion).mockImplementation(() => new Promise(() => {}));
    renderComponent();
    // Should show a loading/spinner state
    const spinner = document.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('renders the question text after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/what is a variable in python/i)).toBeInTheDocument();
    });
  });

  it('renders all 4 answer options', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/A container for storing data/i)).toBeInTheDocument();
      expect(screen.getByText(/A type of loop/i)).toBeInTheDocument();
      expect(screen.getByText(/A function definition/i)).toBeInTheDocument();
      expect(screen.getByText(/A module import/i)).toBeInTheDocument();
    });
  });

  it('renders the difficulty badge', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/easy/i)).toBeInTheDocument();
    });
  });

  // ---- Interaction -----------------------------------------

  it('selecting an answer enables the submit button', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/what is a variable in python/i)).toBeInTheDocument();
    });

    // Initially submit button should be disabled
    const submitBtn = screen.getByRole('button', { name: /submit answer/i });
    expect(submitBtn).toBeDisabled();

    // Click an option
    const optionBtn = screen.getByRole('button', { name: /option a/i });
    await user.click(optionBtn);

    expect(submitBtn).not.toBeDisabled();
  });

  it('shows feedback banner after submitting a correct answer', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.submitQuizAnswer).mockResolvedValue({
      isCorrect: true,
      feedback: '✓ Correct! Variables mastery increased.',
      masteryDelta: 0.05,
      newMastery: 0.65,
      updatedMasteryMap: {
        Variables: {
          concept: 'Variables',
          score: 0.65,
          attempts: 1,
          correctAttempts: 1,
          lastUpdated: new Date().toISOString(),
          trend: [0.1, 0.65],
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/what is a variable in python/i)).toBeInTheDocument();
    });

    const optionBtn = screen.getByRole('button', { name: /option a/i });
    await user.click(optionBtn);

    const submitBtn = screen.getByRole('button', { name: /submit answer/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('shows Gemini misconception feedback after a wrong answer', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.submitQuizAnswer).mockResolvedValue({
      isCorrect: false,
      feedback: 'Not quite! A variable stores data, not a loop construct.',
      masteryDelta: -0.03,
      newMastery: 0.07,
      updatedMasteryMap: {
        Variables: {
          concept: 'Variables',
          score: 0.07,
          attempts: 1,
          correctAttempts: 0,
          lastUpdated: new Date().toISOString(),
          trend: [0.1, 0.07],
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/what is a variable in python/i)).toBeInTheDocument();
    });

    // Pick the wrong option (B)
    const wrongOption = screen.getByRole('button', { name: /option b/i });
    await user.click(wrongOption);

    const submitBtn = screen.getByRole('button', { name: /submit answer/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // The FeedbackBanner renders "Not quite." as heading (via the isCorrect=false branch)
      // and the Gemini misconception text is in a separate paragraph
      expect(screen.getByRole('status')).toBeInTheDocument();
      // Check that the misconception text is somewhere in the document
      expect(screen.getByText(/a variable stores data, not a loop construct/i)).toBeInTheDocument();
    });
  });

  it('shows "Next Question" button after submitting', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.submitQuizAnswer).mockResolvedValue({
      isCorrect: true,
      feedback: 'Correct!',
      masteryDelta: 0.05,
      newMastery: 0.5,
      updatedMasteryMap: {},
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/what is a variable in python/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /option a/i }));
    await user.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next question/i })).toBeInTheDocument();
    });
  });

  // ---- Adaptive rationale ----------------------------------

  it('displays the adaptive selection rationale', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/why this question/i)).toBeInTheDocument();
    });
  });

  // ---- Accessibility ---------------------------------------

  it('progress bar has aria-valuenow', async () => {
    renderComponent();
    await waitFor(() => {
      const progressbar = screen.getByRole('progressbar', { name: /quiz progress/i });
      expect(progressbar).toHaveAttribute('aria-valuenow');
    });
  });

  it('score counter is visible in nav', async () => {
    renderComponent();
    await waitFor(() => {
      // Score counter "✓ 0/0" should be in the nav
      expect(screen.getByText(/✓/)).toBeInTheDocument();
    });
  });
});

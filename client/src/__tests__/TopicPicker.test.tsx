/**
 * TopicPicker.test.tsx
 *
 * Component tests for the TopicPicker landing page.
 * Mocks API calls and router.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TopicPicker from '../pages/TopicPicker';
import * as apiClient from '../api/client';

// ---- Mock the API client -----------------------------------
vi.mock('../api/client', () => ({
  createSession: vi.fn(),
}));

// ---- Mock react-router navigate ----------------------------
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---- Mock sessionStorage -----------------------------------
const mockSessionStorage: Record<string, string> = {};
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
      <TopicPicker />
    </MemoryRouter>
  );
}

describe('TopicPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage['sessionId'] = '';
  });

  // ---- Rendering -------------------------------------------

  it('renders the page heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the topic input with a label', () => {
    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders the start button as disabled initially', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /start learning/i });
    expect(btn).toBeDisabled();
  });

  it('enables the start button when topic is entered', async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'Python basics');

    const btn = screen.getByRole('button', { name: /start learning/i });
    expect(btn).not.toBeDisabled();
  });

  it('renders example topic chip buttons', () => {
    renderComponent();
    const chips = screen.getAllByRole('button', { name: /use topic:/i });
    expect(chips.length).toBeGreaterThan(0);
  });

  it('clicking a topic chip fills the input', async () => {
    const user = userEvent.setup();
    renderComponent();

    const chip = screen.getByRole('button', { name: /use topic: Python basics/i });
    await user.click(chip);

    const input = screen.getByLabelText(/what do you want to learn/i);
    expect((input as HTMLInputElement).value).toBe('Python basics');
  });

  // ---- Form interaction ------------------------------------

  it('calls createSession with the entered topic on submit', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createSession).mockResolvedValue({
      sessionId: 'test-session-123',
      topic: 'Python basics',
      concepts: ['Variables', 'Loops'],
      firstQuestion: {
        id: 'q1',
        type: 'multiple-choice',
        concept: 'Variables',
        question: 'What is a variable?',
        options: ['A) Data container', 'B) A loop', 'C) A function', 'D) A class'],
        correctAnswer: 'A) Data container',
        difficulty: 'easy',
      },
    });

    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'Python basics');

    const btn = screen.getByRole('button', { name: /start learning/i });
    await user.click(btn);

    expect(apiClient.createSession).toHaveBeenCalledWith('Python basics');
  });

  it('navigates to /diagnostic after successful session creation', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createSession).mockResolvedValue({
      sessionId: 'test-session-123',
      topic: 'Python basics',
      concepts: ['Variables'],
      firstQuestion: {
        id: 'q1',
        type: 'multiple-choice',
        concept: 'Variables',
        question: 'What is a variable?',
        options: ['A)', 'B)', 'C)', 'D)'],
        correctAnswer: 'A)',
        difficulty: 'easy',
      },
    });

    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'Python basics');

    const btn = screen.getByRole('button', { name: /start learning/i });
    await user.click(btn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/diagnostic');
    });
  });

  it('shows an error message when createSession fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createSession).mockRejectedValue(new Error('Network error'));

    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'Python basics');

    const btn = screen.getByRole('button', { name: /start learning/i });
    await user.click(btn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toContain('Network error');
    });
  });

  it('shows loading state while creating session', async () => {
    const user = userEvent.setup();
    // Never resolves — keeps loading state active
    vi.mocked(apiClient.createSession).mockImplementation(
      () => new Promise(() => {})
    );

    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'Python basics');

    const btn = screen.getByRole('button', { name: /start learning/i });
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/generating your personalized curriculum/i)).toBeInTheDocument();
    });
  });

  // ---- Accessibility ---------------------------------------

  it('has a proper heading hierarchy (h1 exists)', () => {
    renderComponent();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
  });

  it('input has aria-describedby hint', () => {
    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    expect(input).toHaveAttribute('aria-describedby', 'topic-hint');
  });

  it('start button has aria-busy when loading', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createSession).mockImplementation(() => new Promise(() => {}));

    renderComponent();
    const input = screen.getByLabelText(/what do you want to learn/i);
    await user.type(input, 'test');

    const btn = screen.getByRole('button', { name: /start learning/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
  });
});

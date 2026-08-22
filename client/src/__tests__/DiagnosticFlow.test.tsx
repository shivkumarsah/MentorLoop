import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DiagnosticFlow from '../pages/DiagnosticFlow';

vi.mock('../api/client');

describe('DiagnosticFlow Page', () => {
  beforeEach(() => {
    const mockQuestion = {
      id: 'q-1',
      type: 'multiple-choice',
      concept: 'Variables',
      question: 'What is a variable?',
      options: ['A) Container', 'B) Function', 'C) Loop', 'D) Class'],
      correctAnswer: 'A) Container',
      difficulty: 'easy',
    };
    sessionStorage.setItem('sessionId', 'test-session-1');
    sessionStorage.setItem('topic', 'Python basics');
    sessionStorage.setItem('firstQuestion', JSON.stringify(mockQuestion));
    vi.clearAllMocks();
  });

  it('renders first diagnostic question loaded from sessionStorage', () => {
    render(
      <MemoryRouter>
        <DiagnosticFlow />
      </MemoryRouter>
    );

    expect(screen.getByText('What is a variable?')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Diagnostic')).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Answer/i })).toBeInTheDocument();
  });
});

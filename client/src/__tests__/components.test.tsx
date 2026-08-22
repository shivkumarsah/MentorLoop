import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MasteryBar from '../components/MasteryBar';
import FeedbackBanner from '../components/FeedbackBanner';
import QuestionCard from '../components/QuestionCard';

describe('Navbar Component', () => {
  it('renders logo and brand text', () => {
    render(
      <MemoryRouter>
        <Navbar badgeText="AI Tutor" />
      </MemoryRouter>
    );
    expect(screen.getByText('MentorLoop')).toBeInTheDocument();
    expect(screen.getByText('AI Tutor')).toBeInTheDocument();
  });

  it('renders topic and buttons when passed', () => {
    render(
      <MemoryRouter>
        <Navbar
          topic="Python basics"
          showNewTopicButton
          showDashboardButton
          scoreText="✓ 3/5"
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Python basics')).toBeInTheDocument();
    expect(screen.getByText('✓ 3/5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new topic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe('MasteryBar Component', () => {
  it('renders concept label and percentage for low mastery', () => {
    render(<MasteryBar concept="Variables" score={0.2} />);
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/Beginner/i)).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '20');
  });

  it('renders correct labels for intermediate and mastered scores', () => {
    const { rerender } = render(<MasteryBar concept="Loops" score={0.6} />);
    expect(screen.getByText(/Intermediate/i)).toBeInTheDocument();

    rerender(<MasteryBar concept="Loops" score={0.95} />);
    expect(screen.getByText(/Mastered/i)).toBeInTheDocument();
  });
});

describe('FeedbackBanner Component', () => {
  it('renders correct feedback with aria live status', () => {
    render(
      <FeedbackBanner
        isCorrect={true}
        message="Great job explaining!"
        masteryDelta={0.15}
        visible={true}
      />
    );
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText('+15.0% mastery')).toBeInTheDocument();
    expect(screen.getByText('Great job explaining!')).toBeInTheDocument();
  });

  it('renders incorrect feedback with negative delta', () => {
    render(
      <FeedbackBanner
        isCorrect={false}
        message="That was a misconception."
        masteryDelta={-0.05}
        visible={true}
      />
    );
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    expect(screen.getByText('-5.0% mastery')).toBeInTheDocument();
  });
});

describe('QuestionCard Component', () => {
  it('renders question, options, and difficulty badge', () => {
    const onSelect = vi.fn();
    render(
      <QuestionCard
        question="What is a boolean?"
        options={['A) True/False', 'B) A number', 'C) Text', 'D) List']}
        selectedAnswer={null}
        onSelectAnswer={onSelect}
        submitted={false}
        difficulty="easy"
        questionNumber={2}
        totalQuestions={5}
        rationale="Selected to assess baseline data types"
      />
    );

    expect(screen.getByText('What is a boolean?')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 5')).toBeInTheDocument();

    const optA = screen.getByRole('button', { name: /Option A/i });
    fireEvent.click(optA);
    expect(onSelect).toHaveBeenCalledWith('A) True/False');
  });
});

# MentorLoop — Adaptive Learning Intelligence System

> **Hackathon**: PromptWars-Pilot (Google for Developers)
> **Vertical**: Adaptive Learning Intelligence System

---

## What is MentorLoop?

MentorLoop is an AI-powered adaptive learning companion. A learner picks any topic — from "Python basics" to "Photosynthesis" to "World War II causes" — and the system:

1. **Diagnoses** their starting knowledge with a 5-question adaptive diagnostic
2. **Models** their mastery per concept using Bayesian Knowledge Tracing (BKT)
3. **Explains** weak concepts via Google Gemini, adapting depth to their mastery level
4. **Quizzes** them adaptively — always targeting the weakest concept, occasionally revisiting mastered ones (spaced repetition)
5. **Feeds back** immediately on wrong answers with Gemini-generated misconception explanations
6. **Tracks progress** on a live dashboard with per-concept mastery bars and trend data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript (strict) |
| Backend | Node.js + Express + TypeScript (strict) |
| AI | Google Gemini API (`gemini-2.0-flash`) via `@google/generative-ai` |
| Persistence | `lowdb` (JSON file — zero native dependencies, git-ignored) |
| Validation | `zod` on all API request bodies |
| Rate Limiting | `express-rate-limit` on all AI-backed routes |
| Testing | Vitest + React Testing Library (client) + Supertest (server) |

---

## How the Knowledge Tracing Model Works

### Bayesian Knowledge Tracing (BKT)

The core of MentorLoop is a pure, side-effect-free BKT implementation in [`server/src/knowledge-tracing.ts`](./server/src/knowledge-tracing.ts).

**BKT parameters:**
- `P_learn = 0.10` — probability of transitioning from "not known" to "known" after each practice opportunity
- `P_guess = 0.20` — probability of a correct answer despite not knowing
- `P_slip = 0.10` — probability of an incorrect answer despite knowing

**Update formula (per answer):**

1. **Bayesian update** — compute P(knows | observation):
   - Correct: `P_new = P(correct|knows) × P(knows) / P(correct)`
   - Wrong: `P_new = P(wrong|knows) × P(knows) / P(wrong)`

2. **Learning gain** — apply transition probability:
   - `P_final = P_new + (1 - P_new) × P_learn`

3. **Difficulty modifier** — adjusts effective guess/slip rates:
   - Easy: P_guess +0.05, P_slip −0.02
   - Hard: P_guess −0.05, P_slip +0.05

Scores are clamped to [0, 1]. Mastery ≥ 0.70 = "mastered".

### Adaptive Question Selection

On every call to `POST /api/quiz/next`, the server:

1. Partitions concepts into **weak** (score < 0.70) and **strong** (≥ 0.70)
2. Targets the **weakest concept** by default
3. With 20% probability (or when ≥ 30% of concepts are mastered), selects a strong concept for **spaced repetition**
4. Maps mastery to difficulty: < 0.30 → easy, 0.30–0.60 → medium, > 0.60 → hard
5. Returns a **`rationale` string** with every question explaining the selection decision

This rationale is shown to learners under "Why this question?" — demonstrating transparent, logged decision-making.

---

## How Gemini AI Is Used

All Gemini calls go through [`server/src/gemini-service.ts`](./server/src/gemini-service.ts), isolated behind a clean interface. The key is **never exposed to the frontend**.

| Feature | Gemini call |
|---------|------------|
| Concept extraction | Given a topic, identify 4–6 sub-concepts |
| Diagnostic questions | Generate adaptive MCQs per concept |
| Explanations | Mastery-adapted prose (beginner or technical) |
| Quiz questions | Difficulty-appropriate MCQs per concept |
| Misconception feedback | 2–3 sentence correction for wrong answers |

Explanations are cached per `(sessionId, concept, style)` to avoid redundant API calls.

---

## Setup & Running

### Prerequisites

- Node.js ≥ 18
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd PromptWars-GGN

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### 3. Run the Server

```bash
cd server
npm run dev
# → Running on http://localhost:3001
```

### 4. Run the Client

In a new terminal:

```bash
cd client
npm run dev
# → Running on http://localhost:5173
```

### 5. Open the App

Navigate to **http://localhost:5173** in your browser.

---

## Running Tests

### All tests (from repo root — requires root package.json workspaces)

```bash
# From repo root
npm test
```

### Server tests only (unit + integration)

```bash
cd server
npm test
```

Covers:
- BKT mastery update (correct/wrong, edge cases, custom parameters, monotonicity)
- Adaptive question selection (weakest concept, spaced repetition, difficulty mapping)
- Integration tests for all API routes with Gemini mocked (never calls real API)

### Client tests only (component tests)

```bash
cd client
npm test
```

Covers:
- TopicPicker: renders, form interaction, createSession call, navigation, error handling, accessibility
- QuizFlow: question rendering, answer selection, feedback display, adaptive rationale

---

## User Flow Walkthrough

```
1. TOPIC PICKER (/)
   └─ User types "Python basics" → clicks "Start Learning"
   └─ Backend calls Gemini to extract 5 concepts + generate first diagnostic question
   └─ Session created and persisted to db.json

2. DIAGNOSTIC (/diagnostic)
   └─ 5 adaptive questions — difficulty shifts based on correctness
   └─ BKT mastery updated after each answer
   └─ FeedbackBanner shows result + mastery delta
   └─ On completion → redirect to Dashboard

3. DASHBOARD (/dashboard)
   └─ Overall mastery %, per-concept MasteryBar
   └─ Mastered / In Progress / Total stats
   └─ "Start Adaptive Quiz" and "Explain: [recommended concept]" CTAs
   └─ Inline "Explain" button per concept

4. EXPLAIN (/explain)
   └─ Gemini generates a 3–5 paragraph explanation
   └─ Beginner / Technical style toggle (cached per style)
   └─ Mastery bar for current concept
   └─ CTA to quiz

5. QUIZ (/quiz)
   └─ 8 adaptive questions — adaptive BKT selection with rationale
   └─ Wrong answers → Gemini misconception feedback
   └─ Live score counter
   └─ Quiz Complete screen with updated mastery map

6. UPDATED DASHBOARD
   └─ Refresh shows new mastery scores after quiz
```

---

## Architecture

```
PromptWars-GGN/
├── shared/
│   └── types.ts              # Shared TypeScript interfaces
├── server/
│   ├── src/
│   │   ├── knowledge-tracing.ts  # Pure BKT — no side effects, fully testable
│   │   ├── gemini-service.ts     # Gemini integration (mockable interface)
│   │   ├── db.ts                 # lowdb persistence layer
│   │   ├── app.ts                # Express app (CORS, rate limiting, routes)
│   │   ├── index.ts              # Server entry point
│   │   ├── routes/
│   │   │   ├── session.ts        # POST /api/session
│   │   │   ├── diagnostic.ts     # POST /api/diagnostic/answer
│   │   │   ├── mastery.ts        # GET  /api/mastery/:sessionId
│   │   │   ├── explain.ts        # POST /api/explain
│   │   │   └── quiz.ts           # POST /api/quiz/next, /api/quiz/answer
│   │   └── __tests__/
│   │       ├── knowledge-tracing.test.ts  # 40+ pure unit tests
│   │       └── quiz-routes.test.ts         # 20+ integration tests (Gemini mocked)
│   └── vitest.config.ts
├── client/
│   ├── src/
│   │   ├── api/client.ts          # Typed API functions
│   │   ├── pages/
│   │   │   ├── TopicPicker.tsx
│   │   │   ├── DiagnosticFlow.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ExplainView.tsx
│   │   │   └── QuizFlow.tsx
│   │   ├── components/
│   │   │   ├── MasteryBar.tsx     # aria-progressbar
│   │   │   ├── FeedbackBanner.tsx # aria-live region
│   │   │   └── QuestionCard.tsx   # Accessible answer buttons
│   │   └── __tests__/
│   │       ├── TopicPicker.test.tsx
│   │       └── QuizFlow.test.tsx
│   └── index.css                  # Global design system
└── .env.example                   # Copy to .env and fill keys
```

---

## Security Measures

| Concern | Implementation |
|---------|---------------|
| API key protection | Server-side only, read from `.env` (git-ignored), never sent to client |
| Input validation | Zod schemas on every POST request body |
| Rate limiting | `express-rate-limit`: 30 req / 15 min per IP on all AI endpoints |
| CORS | Restricted to `CORS_ORIGIN` env var (default: `localhost:5173`), not wildcard `*` |
| Payload size | Express body limit: 10 KB |
| No hardcoded secrets | All credentials via `.env` |

---

## Accessibility

- Semantic HTML throughout (`<main>`, `<nav>`, `<header>`, `<section>`, `<fieldset>`, `<legend>`)
- Single `<h1>` per page with proper hierarchy
- `<button>` elements for all interactive controls (never `<div onClick>`)
- All form inputs have associated `<label>` elements
- ARIA live regions (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) for feedback announcements
- `role="progressbar"` with `aria-valuenow/min/max` on all progress bars
- `aria-pressed` on toggle buttons
- `aria-busy` on submit buttons during loading
- Visible focus states (2px outline on `:focus-visible`)
- Color + icon + text used together (never color alone) for correct/incorrect states
- Sufficient contrast: text colors ≥ 4.5:1 on dark backgrounds

---

## Assumptions

1. **Topic scope**: Any text topic is valid. Gemini extracts 4–6 sub-concepts automatically.
2. **"Concept" definition**: A 2–4 word sub-topic returned by Gemini's extraction prompt.
3. **Diagnostic length**: Fixed at 5 questions (configurable via `DIAGNOSTIC_QUESTIONS_TOTAL`).
4. **BKT parameters**: Fixed defaults (P_learn=0.10, P_guess=0.20, P_slip=0.10). Per-concept tuning would require historical data.
5. **Persistence**: `db.json` is local — sessions survive server restarts but not machine migration.
6. **Quiz length**: Default 8 questions per round (configurable via `QUIZ_LENGTH` constant).
7. **No authentication**: Sessions identified by UUID stored in `sessionStorage` — suitable for demo purposes.

---

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:server` | Start Express server with file watching |
| `npm run dev:client` | Start Vite dev server |
| `npm run test:server` | Run server unit + integration tests |
| `npm run test:client` | Run client component tests |
| `npm test` | Run all tests |
| `npm run lint` | Lint both workspaces |

---

*Built for PromptWars-Pilot · Google for Developers Hackathon*
*Uses Google Gemini API (`gemini-2.0-flash`) for adaptive AI-powered learning*

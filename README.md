# Agent Studio

A visual canvas application for building AI agent prompts, simulating conversations, and scoring interactions. Built with Next.js and React Flow, Agent Studio provides a node-based interface for composing structured call prompts and scoring prompts without writing raw text.

## Features

### Call Prompt Builder

Drag-and-drop canvas for assembling structured system prompts from reusable blocks:

- **Persona** -- define the agent's identity and tone
- **Job Info** -- provide role and context
- **Rules** -- set behavioral constraints
- **Scenario** -- describe situational context
- **Instructions** -- add step-by-step guidance
- **Section / Question** -- organize interview questions hierarchically
- **FAQ** -- include frequently asked questions
- **Global Constraint** -- apply cross-cutting rules

Prompts can be imported from text, generated from the canvas layout, and exported for use elsewhere.

### Scoring Prompt Builder

A separate tabbed canvas for creating evaluation rubrics:

- **Indicator Overview** -- high-level description of what is being scored
- **Input Context** -- context the evaluator needs
- **Scoring Attribute** -- individual metrics with configurable fields
- **Scoring Instructions** -- step-by-step evaluation guidance
- **Evaluator Guardrails** -- boundaries for the scoring model
- **Output Format** -- structure of the expected result

Supports multiple scoring prompt tabs with independent state, renaming, and deletion.

### Conversation Simulation

Run turn-based conversations between an AI interviewer and candidate:

- Powered by Google Gemini 2.5 Flash
- Configurable candidate system prompt
- Adjustable max turn count
- View results as chat bubbles or raw JSON

### Automated Scoring

Evaluate completed conversations against scoring prompts:

- Powered by OpenAI GPT-4o
- Runs scoring across all configured tabs
- Displays formatted results in a side panel

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, [shadcn/ui](https://ui.shadcn.com), Radix UI, Tailwind CSS 4 |
| Canvas | [React Flow](https://reactflow.dev) (@xyflow/react) |
| AI -- Conversation | [Google Gemini API](https://ai.google.dev) (gemini-2.5-flash) |
| AI -- Scoring | [OpenAI API](https://platform.openai.com) (gpt-4o) |
| Icons | [Lucide React](https://lucide.dev) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or another package manager)
- A [Google AI Studio](https://aistudio.google.com) API key (for conversation simulation)
- An [OpenAI](https://platform.openai.com/api-keys) API key (for scoring)

### Installation

```bash
git clone <repository-url>
cd agent-studio
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

Both keys are accessed server-side only through Next.js API routes.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── conversation/route.ts   # Gemini conversation endpoint
│   │   └── scoring/route.ts        # OpenAI scoring endpoint
│   ├── globals.css                  # Tailwind base styles
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Entry point
├── components/
│   ├── handlers/                    # Business logic (separated from UI)
│   │   ├── conversation-handlers.ts
│   │   ├── flow-canvas-handlers.ts
│   │   ├── scoring-flow-canvas-handlers.ts
│   │   ├── scoring-runner-handlers.ts
│   │   └── ...
│   ├── ui/                          # shadcn/ui primitives
│   ├── flow-canvas.tsx              # Call prompt canvas
│   ├── scoring-flow-canvas.tsx      # Scoring prompt canvas
│   ├── conversation-panel.tsx       # Conversation simulation UI
│   ├── scoring-results-panel.tsx    # Scoring results display
│   ├── prompt-workspace.tsx         # Main workspace layout
│   └── ...
├── hooks/
│   └── use-mobile.ts               # Responsive breakpoint hook
└── lib/
    ├── block-types.ts               # Call prompt block definitions
    ├── scoring-block-types.ts       # Scoring prompt block definitions
    └── utils.ts                     # Shared utilities
```

## API Routes

### `POST /api/conversation`

Sends a message in a multi-turn conversation using Gemini.

**Request body:**

```json
{
  "systemPrompt": "You are an interviewer...",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "model", "content": "Hi there" }
  ],
  "agentRole": "interviewer"
}
```

### `POST /api/scoring`

Scores a conversation transcript using OpenAI.

**Request body:**

```json
{
  "scoringPrompt": "Evaluate the following conversation...",
  "conversation": "Interviewer: ... Candidate: ..."
}
```

## License

This project is private and not published under an open-source license.

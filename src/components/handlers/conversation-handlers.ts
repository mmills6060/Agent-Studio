interface ConversationMessage {
  role: "interviewer" | "candidate"
  content: string
}

interface ConversationState {
  messages: ConversationMessage[]
  isRunning: boolean
  currentTurn: number
  maxTurns: number
  error: string | null
}

interface AgentHistoryMessage {
  role: "user" | "model"
  content: string
}

const DEFAULT_CANDIDATE_PROMPT = `You are a job candidate participating in a phone interview. You are being interviewed for the position described by the interviewer. Respond naturally and conversationally as a real candidate would — answer questions thoughtfully, ask for clarification when needed, and keep your responses concise but substantive. Do not break character or reference that you are an AI.`

function createInitialState(maxTurns: number): ConversationState {
  return {
    messages: [],
    isRunning: false,
    currentTurn: 0,
    maxTurns,
    error: null,
  }
}

function buildCandidateSystemPrompt(candidateContext: string): string {
  const base = DEFAULT_CANDIDATE_PROMPT
  if (!candidateContext.trim()) return base
  return `${base}\n\nHere is additional context about your background and the role:\n${candidateContext}`
}

function formatHistoryForAgent(
  messages: ConversationMessage[],
  agentRole: "interviewer" | "candidate",
): AgentHistoryMessage[] {
  return messages.map((msg) => ({
    role: msg.role === agentRole ? "model" : "user",
    content: msg.content,
  }))
}

async function fetchAgentResponse(
  systemPrompt: string,
  history: AgentHistoryMessage[],
  agentRole: "interviewer" | "candidate",
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, history, agentRole }),
    signal,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.message
}

export {
  createInitialState,
  buildCandidateSystemPrompt,
  formatHistoryForAgent,
  fetchAgentResponse,
  DEFAULT_CANDIDATE_PROMPT,
}
export type { ConversationMessage, ConversationState, AgentHistoryMessage }

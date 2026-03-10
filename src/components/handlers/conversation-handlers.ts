interface ConversationMessage {
  id: string
  role: "interviewer" | "candidate"
  content: string
}

interface RunAiVsAiConversationParams {
  callPrompt: string
  contextResult?: string | null
  candidatePrompt: string
  maxTurns: number
  signal: AbortSignal
  onSetActiveAgent: (agent: "interviewer" | "candidate" | null) => void
  onTurnUpdate: (messages: ConversationMessage[], turn: number) => void
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

type ConversationMode = "ai-vs-ai" | "human-candidate"

const DEFAULT_CANDIDATE_PROMPT = `You are a job candidate participating in a phone interview. You are being interviewed for the position described by the interviewer. Respond naturally and conversationally as a real candidate would — answer questions thoughtfully, ask for clarification when needed, and keep your responses concise but substantive. Do not break character or reference that you are an AI.`

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID()

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createConversationMessage(
  role: "interviewer" | "candidate",
  content: string,
): ConversationMessage {
  return {
    id: createMessageId(),
    role,
    content,
  }
}

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

function buildEffectivePrompt(callPrompt: string, contextResult?: string | null): string {
  if (!contextResult?.trim()) return callPrompt
  return `${callPrompt}\n\n--- Context Prompt Output ---\n${contextResult}`
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

async function fetchInterviewerReply(
  callPrompt: string,
  contextResult: string | null | undefined,
  messages: ConversationMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const effectivePrompt = buildEffectivePrompt(callPrompt, contextResult)
  const interviewerHistory = formatHistoryForAgent(messages, "interviewer")
  return fetchAgentResponse(effectivePrompt, interviewerHistory, "interviewer", signal)
}

function buildCandidateMessage(content: string): ConversationMessage {
  return createConversationMessage("candidate", content)
}

async function runAiVsAiConversation({
  callPrompt,
  contextResult,
  candidatePrompt,
  maxTurns,
  signal,
  onSetActiveAgent,
  onTurnUpdate,
}: RunAiVsAiConversationParams): Promise<ConversationMessage[]> {
  const effectivePrompt = buildEffectivePrompt(callPrompt, contextResult)
  const candidateSystemPrompt = buildCandidateSystemPrompt(candidatePrompt)
  const messages: ConversationMessage[] = []

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal.aborted) break

    onSetActiveAgent("interviewer")
    const interviewerHistory = formatHistoryForAgent(messages, "interviewer")
    const interviewerMsg = await fetchAgentResponse(
      effectivePrompt,
      interviewerHistory,
      "interviewer",
      signal,
    )
    const interviewerEntry = createConversationMessage("interviewer", interviewerMsg)
    messages.push(interviewerEntry)
    onTurnUpdate([...messages], turn + 1)

    if (signal.aborted) break

    onSetActiveAgent("candidate")
    const candidateHistory = formatHistoryForAgent(messages, "candidate")
    const candidateMsg = await fetchAgentResponse(
      candidateSystemPrompt,
      candidateHistory,
      "candidate",
      signal,
    )
    const candidateEntry = createConversationMessage("candidate", candidateMsg)
    messages.push(candidateEntry)
    onTurnUpdate([...messages], turn + 1)
  }

  return messages
}

export {
  createInitialState,
  buildCandidateSystemPrompt,
  buildEffectivePrompt,
  formatHistoryForAgent,
  fetchAgentResponse,
  fetchInterviewerReply,
  createConversationMessage,
  buildCandidateMessage,
  runAiVsAiConversation,
  DEFAULT_CANDIDATE_PROMPT,
}
export type { ConversationMessage, ConversationState, AgentHistoryMessage, ConversationMode }

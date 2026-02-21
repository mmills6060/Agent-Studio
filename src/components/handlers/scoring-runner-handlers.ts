import type { Node, Edge } from "@xyflow/react"
import type { ScoringNodeData } from "@/components/handlers/scoring-flow-canvas-handlers"
import { generateScoringPrompt } from "@/components/handlers/scoring-flow-canvas-handlers"
import type { ConversationMessage } from "@/components/handlers/conversation-handlers"

interface ScoringResult {
  tabId: string
  tabName: string
  result: string
  isLoading: boolean
  error: string | null
}

interface ScoringTab {
  id: string
  name: string
  nodes: Node<ScoringNodeData>[]
  edges: Edge[]
}

function formatConversationTranscript(messages: ConversationMessage[]): string {
  if (messages.length === 0) return ""
  return messages
    .map((msg) => {
      const speaker = msg.role === "interviewer" ? "Interviewer" : "Candidate"
      return `${speaker}: ${msg.content}`
    })
    .join("\n\n")
}

function createEmptyResults(tabs: ScoringTab[]): ScoringResult[] {
  return tabs.map((tab) => ({
    tabId: tab.id,
    tabName: tab.name,
    result: "",
    isLoading: true,
    error: null,
  }))
}

async function fetchScoringResult(
  scoringPrompt: string,
  conversation: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/scoring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoringPrompt, conversation }),
    signal,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.result
}

async function runSingleScoring(
  tab: ScoringTab,
  conversation: string,
  signal?: AbortSignal,
): Promise<ScoringResult> {
  const scoringPrompt = generateScoringPrompt(
    tab.nodes as Node<ScoringNodeData>[],
    tab.edges,
  )

  if (!scoringPrompt.trim())
    return {
      tabId: tab.id,
      tabName: tab.name,
      result: "",
      isLoading: false,
      error: "Scoring prompt is empty. Add blocks to the scoring canvas first.",
    }

  try {
    const result = await fetchScoringResult(scoringPrompt, conversation, signal)
    return {
      tabId: tab.id,
      tabName: tab.name,
      result,
      isLoading: false,
      error: null,
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err
    return {
      tabId: tab.id,
      tabName: tab.name,
      result: "",
      isLoading: false,
      error: (err as Error).message ?? "Unknown error",
    }
  }
}

export {
  formatConversationTranscript,
  createEmptyResults,
  runSingleScoring,
}
export type { ScoringResult, ScoringTab }

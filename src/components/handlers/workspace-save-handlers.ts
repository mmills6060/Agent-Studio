import type { Node, Edge } from "@xyflow/react"
import type { CustomNodeData } from "@/components/handlers/flow-canvas-handlers"
import type { ContextNodeData } from "@/components/handlers/context-flow-canvas-handlers"
import type { ScoringPromptTab } from "@/components/handlers/scoring-prompt-manager-handlers"

interface WorkspaceState {
  callPrompt: {
    nodes: Node<CustomNodeData>[]
    edges: Edge[]
  }
  contextPrompt: {
    nodes: Node<ContextNodeData>[]
    edges: Edge[]
  }
  scoringTabs: ScoringPromptTab[]
  activeTab: string
  currentScoringTabId: string
}

const STORAGE_KEY = "agent-studio-workspace"

function saveWorkspace(state: WorkspaceState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function loadWorkspace(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>
    if (!parsed.callPrompt || !parsed.scoringTabs) return null
    return {
      callPrompt: parsed.callPrompt,
      contextPrompt: parsed.contextPrompt ?? { nodes: [], edges: [] },
      scoringTabs: parsed.scoringTabs,
      activeTab: parsed.activeTab ?? "call-prompt",
      currentScoringTabId:
        parsed.currentScoringTabId ?? parsed.scoringTabs[0]?.id ?? "",
    }
  } catch {
    return null
  }
}

function clearWorkspace(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export { saveWorkspace, loadWorkspace, clearWorkspace, STORAGE_KEY }
export type { WorkspaceState }

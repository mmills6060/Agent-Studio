import type { Node, Edge } from "@xyflow/react"
import type { ScoringNodeData } from "@/components/handlers/scoring-flow-canvas-handlers"

interface ScoringPromptTab {
  id: string
  name: string
  nodes: Node<ScoringNodeData>[]
  edges: Edge[]
}

let tabCounter = 0

function createScoringPromptTab(name?: string): ScoringPromptTab {
  tabCounter += 1
  return {
    id: `scoring-tab-${tabCounter}-${Date.now()}`,
    name: name ?? `Scoring Prompt ${tabCounter}`,
    nodes: [],
    edges: [],
  }
}

function renameScoringPromptTab(
  tabs: ScoringPromptTab[],
  tabId: string,
  newName: string,
): ScoringPromptTab[] {
  return tabs.map((tab) =>
    tab.id === tabId ? { ...tab, name: newName } : tab,
  )
}

function deleteScoringPromptTab(
  tabs: ScoringPromptTab[],
  tabId: string,
): ScoringPromptTab[] {
  if (tabs.length <= 1) return tabs
  return tabs.filter((tab) => tab.id !== tabId)
}

function saveScoringPromptTabState(
  tabs: ScoringPromptTab[],
  tabId: string,
  nodes: Node<ScoringNodeData>[],
  edges: Edge[],
): ScoringPromptTab[] {
  return tabs.map((tab) =>
    tab.id === tabId ? { ...tab, nodes, edges } : tab,
  )
}

export {
  createScoringPromptTab,
  renameScoringPromptTab,
  deleteScoringPromptTab,
  saveScoringPromptTabState,
}
export type { ScoringPromptTab }

import type { Node, Edge } from "@xyflow/react"
import { parsePromptToFlow } from "./prompt-parser"
import type { CustomNodeData } from "./flow-canvas-handlers"

interface ImportResult {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
}

function handleImportPrompt(rawText: string): ImportResult {
  if (!rawText.trim()) return { nodes: [], edges: [] }
  return parsePromptToFlow(rawText)
}

export { handleImportPrompt }

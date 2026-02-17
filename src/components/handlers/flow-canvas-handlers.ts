import type { Node, Edge } from "@xyflow/react"

interface CustomNodeData {
  label: string
  nodeType: string
  content: string
  [key: string]: unknown
}

let nodeIdCounter = 0

function createPromptBlock(
  position: { x: number; y: number }
): Node<CustomNodeData> {
  nodeIdCounter += 1

  return {
    id: `prompt-${nodeIdCounter}-${Date.now()}`,
    type: "custom",
    position,
    data: {
      label: "Prompt Block",
      nodeType: "prompt",
      content: "",
    },
  }
}

function updateNodeData(
  nodes: Node<CustomNodeData>[],
  nodeId: string,
  updates: Partial<Pick<CustomNodeData, "label" | "content">>
): Node<CustomNodeData>[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      data: { ...node.data, ...updates },
    }
  })
}

function generateSystemPrompt(
  nodes: Node<CustomNodeData>[],
  edges: Edge[]
): string {
  if (edges.length === 0) return ""

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const connectedNodes = new Set<string>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  for (const nodeId of connectedNodes) {
    inDegree.set(nodeId, 0)
    adjacency.set(nodeId, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
    .map((id) => nodeMap.get(id)?.data.content ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n")
}

export { createPromptBlock, updateNodeData, generateSystemPrompt }
export type { CustomNodeData }

import type { Node, Edge } from "@xyflow/react"
import { getScoringBlockType } from "@/lib/scoring-block-types"

interface ScoringNodeData {
  label: string
  nodeType: string
  blockType: string
  content: string
  maxPoints: number
  source: string
  goal: string
  scoringRules: string
  examples: string
  [key: string]: unknown
}

let nodeIdCounter = 0

function createScoringBlock(
  blockType: string,
  position: { x: number; y: number },
): Node<ScoringNodeData> {
  nodeIdCounter += 1
  const config = getScoringBlockType(blockType)
  const label = config?.label ?? "Scoring Block"

  return {
    id: `scoring-${blockType}-${nodeIdCounter}-${Date.now()}`,
    type: "custom",
    position,
    data: {
      label,
      nodeType: blockType,
      blockType,
      content: "",
      maxPoints: 0,
      source: "",
      goal: "",
      scoringRules: "",
      examples: "",
    },
  }
}

function updateScoringNodeData(
  nodes: Node<ScoringNodeData>[],
  nodeId: string,
  updates: Partial<Omit<ScoringNodeData, "nodeType" | "blockType">>,
): Node<ScoringNodeData>[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      data: { ...node.data, ...updates },
    }
  })
}

function topologicalSort(
  nodes: Node<ScoringNodeData>[],
  edges: Edge[],
): Node<ScoringNodeData>[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  if (edges.length === 0)
    return [...nodes].sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0))

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

  const sorted: Node<ScoringNodeData>[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    const node = nodeMap.get(current)
    if (node) sorted.push(node)
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  const unconnected = nodes
    .filter((n) => !connectedNodes.has(n.id))
    .sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0))

  return [...sorted, ...unconnected]
}

function formatScoringAttribute(node: Node<ScoringNodeData>): string {
  const { label, maxPoints, source, goal, scoringRules, examples } = node.data
  const parts: string[] = []

  const header = `${label} \u2013 ${maxPoints} point${maxPoints !== 1 ? "s" : ""}${source ? ` (${source})` : ""}`
  parts.push(header)

  if (goal.trim()) parts.push(`Goal: ${goal.trim()}`)
  if (scoringRules.trim()) parts.push(scoringRules.trim())
  if (examples.trim()) parts.push(`Examples (transcript):\n${examples.trim()}`)

  return parts.join("\n\n")
}

function formatScoringNode(node: Node<ScoringNodeData>): string {
  const { blockType, label, content } = node.data

  switch (blockType) {
    case "indicator-overview": {
      const header = "What this indicator assesses"
      return content.trim() ? `${header}\n${content.trim()}` : ""
    }
    case "input-context": {
      const header = `Important input: ${label}`
      return content.trim() ? `${header}\n${content.trim()}` : ""
    }
    case "scoring-attribute":
      return formatScoringAttribute(node)
    case "scoring-instructions": {
      const header = "Scoring Instructions (Required Process)"
      return content.trim() ? `${header}\n${content.trim()}` : ""
    }
    case "evaluator-guardrails": {
      const header = "Evaluator Guardrails"
      return content.trim() ? `${header}\n${content.trim()}` : ""
    }
    case "output-format": {
      const header = "Standardized Output Format"
      return content.trim() ? `${header}\n${content.trim()}` : ""
    }
    default:
      return content.trim() ?? ""
  }
}

function generateScoringPrompt(
  nodes: Node<ScoringNodeData>[],
  edges: Edge[],
): string {
  if (nodes.length === 0) return ""

  const ordered = topologicalSort(nodes, edges)

  const attributeNodes = ordered.filter((n) => n.data.blockType === "scoring-attribute")
  const nonAttributeNodes = ordered.filter((n) => n.data.blockType !== "scoring-attribute")

  const sections: string[] = []

  for (const node of nonAttributeNodes) {
    if (node.data.blockType === "scoring-instructions") {
      if (attributeNodes.length > 0) {
        const scaleHeader = "Scoring Scale with Examples"
        const attributeSections = attributeNodes
          .map((n) => formatScoringNode(n))
          .filter((t) => t.trim().length > 0)
        if (attributeSections.length > 0)
          sections.push(`${scaleHeader}\n\n${attributeSections.join("\n\n")}`)
      }
    }

    const formatted = formatScoringNode(node)
    if (formatted.trim().length > 0) sections.push(formatted)
  }

  if (attributeNodes.length > 0 && !ordered.some((n) => n.data.blockType === "scoring-instructions")) {
    const scaleHeader = "Scoring Scale with Examples"
    const attributeSections = attributeNodes
      .map((n) => formatScoringNode(n))
      .filter((t) => t.trim().length > 0)
    if (attributeSections.length > 0)
      sections.push(`${scaleHeader}\n\n${attributeSections.join("\n\n")}`)
  }

  return sections.join("\n\n")
}

export { createScoringBlock, updateScoringNodeData, generateScoringPrompt }
export type { ScoringNodeData }

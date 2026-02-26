import type { Node, Edge } from "@xyflow/react"
import { getBlockType } from "@/lib/block-types"

interface CustomNodeData {
  label: string
  nodeType: string
  blockType: string
  content: string
  followUpStrategy: string
  [key: string]: unknown
}

function coerceToString(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.join("\n")
  return String(value ?? "")
}

let nodeIdCounter = 0

function createTypedBlock(
  blockType: string,
  position: { x: number; y: number },
  parentId?: string,
): Node<CustomNodeData> {
  nodeIdCounter += 1
  const config = getBlockType(blockType)
  const label = config?.label ?? "Prompt Block"
  const isSection = blockType === "section"

  const node: Node<CustomNodeData> = {
    id: `${blockType}-${nodeIdCounter}-${Date.now()}`,
    type: isSection ? "section" : "custom",
    position,
    data: {
      label,
      nodeType: blockType,
      blockType,
      content: "",
      followUpStrategy: "",
    },
  }

  if (isSection) {
    node.style = { width: 460, height: 340 }
  }

  if (parentId) {
    node.parentId = parentId
    node.extent = "parent"
  }

  return node
}

function updateNodeData(
  nodes: Node<CustomNodeData>[],
  nodeId: string,
  updates: Partial<Pick<CustomNodeData, "label" | "content" | "followUpStrategy">>,
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
  edges: Edge[],
): string {
  if (edges.length === 0 && nodes.length === 0) return ""

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const childrenByParent = new Map<string, Node<CustomNodeData>[]>()

  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childrenByParent.get(node.parentId) ?? []
      siblings.push(node)
      childrenByParent.set(node.parentId, siblings)
    }
  }

  for (const [parentId, children] of childrenByParent) {
    children.sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0))
    childrenByParent.set(parentId, children)
  }

  const topLevelNodes = nodes.filter((n) => !n.parentId)

  const connectedNodes = new Set<string>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  let orderedNodes: Node<CustomNodeData>[]

  if (edges.length > 0) {
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

    const sortedTopLevel = sorted
      .map((id) => nodeMap.get(id)!)
      .filter((n) => n && !n.parentId)

    const sortedIds = new Set(sortedTopLevel.map((n) => n.id))
    const disconnected = topLevelNodes
      .filter((n) => !sortedIds.has(n.id))
      .sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0))

    orderedNodes = [...disconnected, ...sortedTopLevel]
  } else {
    orderedNodes = [...topLevelNodes]
      .sort((a, b) => (a.position.y ?? 0) - (b.position.y ?? 0))
  }

  const totalSections = orderedNodes.filter(
    (n) => n.data.blockType === "section",
  ).length
  let sectionIndex = 0

  return orderedNodes
    .map((node) => {
      const meta = node.data.blockType === "section"
        ? { index: ++sectionIndex, total: totalSections }
        : undefined
      return formatNodeOutput(node, childrenByParent, meta)
    })
    .filter((text) => text.trim().length > 0)
    .join("\n\n")
}

function formatNodeOutput(
  node: Node<CustomNodeData>,
  childrenByParent: Map<string, Node<CustomNodeData>[]>,
  sectionMeta?: { index: number; total: number },
): string {
  const config = getBlockType(node.data.blockType)
  if (!config) return node.data.content ?? ""

  const tag = config.tag
  const isSection = node.data.blockType === "section"

  if (isSection) {
    const sectionHeader = sectionMeta
      ? `[SECTION ${sectionMeta.index} OF ${sectionMeta.total}: ${node.data.label}]`
      : `${tag.replace("]", `: ${node.data.label}]`)}`
    const children = childrenByParent.get(node.id) ?? []
    const systemInstruction = node.data.content?.trim()

    const parts: string[] = [sectionHeader]

    if (systemInstruction)
      parts.push(`[SYSTEM INSTRUCTION]\n${systemInstruction}`)

    for (const child of children) {
      const questionText = child.data.content?.trim()
      const followUp = coerceToString(child.data.followUpStrategy).trim()

      if (questionText) parts.push(`[CURRENT QUESTION]\n"${questionText}"`)
      if (followUp) parts.push(`[FOLLOW-UP STRATEGY]\n${followUp}`)
    }

    return parts.join("\n\n")
  }

  const content = node.data.content?.trim()
  if (!content) return ""
  return `${tag}\n${content}`
}

export { createTypedBlock, updateNodeData, generateSystemPrompt, coerceToString }
export type { CustomNodeData }

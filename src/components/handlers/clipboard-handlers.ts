import type { Node, Edge } from "@xyflow/react"
import type { CustomNodeData } from "@/components/handlers/flow-canvas-handlers"

interface ClipboardData {
  type: "node" | "section" | "question"
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
}

let clipboard: ClipboardData | null = null

function copyNodes(
  nodeIds: string[],
  allNodes: Node<CustomNodeData>[],
  allEdges: Edge[],
): ClipboardData | null {
  if (nodeIds.length === 0) return null

  const copiedIds = new Set<string>()
  const nodesToCopy: Node<CustomNodeData>[] = []

  for (const nodeId of nodeIds) {
    const node = allNodes.find((n) => n.id === nodeId)
    if (!node || copiedIds.has(node.id)) continue

    nodesToCopy.push(structuredClone(node))
    copiedIds.add(node.id)

    if (node.data.blockType === "section") {
      for (const child of allNodes) {
        if (child.parentId === nodeId && !copiedIds.has(child.id)) {
          nodesToCopy.push(structuredClone(child))
          copiedIds.add(child.id)
        }
      }
    }
  }

  const edgesToCopy = allEdges
    .filter((e) => copiedIds.has(e.source) && copiedIds.has(e.target))
    .map((e) => structuredClone(e))

  const primaryNode = allNodes.find((n) => n.id === nodeIds[0])
  const type: ClipboardData["type"] =
    primaryNode?.data.blockType === "section"
      ? "section"
      : primaryNode?.data.blockType === "question"
        ? "question"
        : "node"

  clipboard = { type, nodes: nodesToCopy, edges: edgesToCopy }
  return clipboard
}

function generatePastedNodes(
  position: { x: number; y: number },
  currentNodes: Node<CustomNodeData>[],
  parentId?: string,
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } | null {
  if (!clipboard || clipboard.nodes.length === 0) return null

  const idMap = new Map<string, string>()
  const timestamp = Date.now()
  let counter = 0
  const newNodes: Node<CustomNodeData>[] = []

  if (parentId && clipboard.type === "question") {
    const existingChildren = currentNodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.position.y - b.position.y)
    const baseY = 110 + existingChildren.length * 90

    for (const node of clipboard.nodes) {
      counter++
      const newId = `${node.data.blockType}-paste-${timestamp}-${counter}`
      idMap.set(node.id, newId)

      newNodes.push({
        ...node,
        id: newId,
        position: { x: 20, y: baseY + (counter - 1) * 90 },
        selected: false,
        data: { ...node.data },
        parentId,
        extent: "parent" as const,
      })
    }
  } else {
    const topLevelCopied = clipboard.nodes.filter((n) => !n.parentId)
    const minX = topLevelCopied.length > 0
      ? Math.min(...topLevelCopied.map((n) => n.position.x))
      : 0
    const minY = topLevelCopied.length > 0
      ? Math.min(...topLevelCopied.map((n) => n.position.y))
      : 0

    for (const node of clipboard.nodes) {
      counter++
      const newId = `${node.data.blockType}-paste-${timestamp}-${counter}`
      idMap.set(node.id, newId)

      const isChild = !!node.parentId
      const newNode: Node<CustomNodeData> = {
        ...node,
        id: newId,
        selected: false,
        data: { ...node.data },
      }

      if (isChild && node.parentId) {
        newNode.position = { ...node.position }
        const mappedParent = idMap.get(node.parentId)
        if (mappedParent) {
          newNode.parentId = mappedParent
          newNode.extent = "parent" as const
        }
      } else {
        newNode.position = {
          x: position.x + (node.position.x - minX),
          y: position.y + (node.position.y - minY),
        }
        delete newNode.parentId
        delete (newNode as Record<string, unknown>).extent
      }

      if (node.data.blockType === "section" && node.style) {
        newNode.style = { ...node.style }
      }

      newNodes.push(newNode)
    }
  }

  const newEdges: Edge[] = clipboard.edges.map((edge) => ({
    ...edge,
    id: `edge-paste-${timestamp}-${++counter}`,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
  }))

  return { nodes: newNodes, edges: newEdges }
}

function hasClipboardData(): boolean {
  return clipboard !== null
}

function getClipboardType(): ClipboardData["type"] | null {
  return clipboard?.type ?? null
}

export { copyNodes, generatePastedNodes, hasClipboardData, getClipboardType }
export type { ClipboardData }

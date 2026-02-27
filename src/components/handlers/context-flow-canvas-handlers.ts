import type { Node, Edge } from "@xyflow/react"
import { getContextBlockType, ALL_CONTEXT_BLOCK_TYPES } from "@/lib/context-block-types"

interface ContextNodeData {
  label: string
  nodeType: string
  blockType: string
  content: string
  [key: string]: unknown
}

let nodeIdCounter = 0

const ROLE_DEFAULT = `You are a Resume Analyzer who will receive information parsed from a Resume, and output information that will serve as reference to a Recruiter as they conduct a Pre-screening Interview over a call with a Candidate.`

const PROCESSING_RULES_DEFAULT = `You will be provided a list of attributes to generate scores on based on information in the Resume.
You will output a score of "0", "1", or "n/a" on every attribute provided.
If the score is "0" or "1", you will provide a rationale for the score.
If the score is "n/a", you will provide info for the attribute.`

const OUTPUT_SCHEMA_DEFAULT = `The output should be a JSON document without any code block or formatting tags, with the following schema:
{
  nameInfo: NameInfo;
  attributeInfo: AttributeInfo[];
}

NameInfo schema:
{
  full_name: string;
  first_name: string;
  last_name: string;
}

AttributeInfo schema:
{
  attribute: string;
  score: "0" | "1" | "n/a";
  rationale: string;
  info: string;
}`

const ATTRIBUTE_DEFAULT = `Attribute : [Name]
Conditions
- score a "1" if [condition]
- score a "0" otherwise`

const INPUT_SOURCE_DEFAULT = `Here is the Resume :`

const DEFAULT_CONTENT: Record<string, string> = {
  role: ROLE_DEFAULT,
  "processing-rules": PROCESSING_RULES_DEFAULT,
  "output-schema": OUTPUT_SCHEMA_DEFAULT,
  attribute: ATTRIBUTE_DEFAULT,
  "input-source": INPUT_SOURCE_DEFAULT,
}

function createContextBlock(
  blockType: string,
  position: { x: number; y: number },
): Node<ContextNodeData> {
  nodeIdCounter += 1
  const config = getContextBlockType(blockType)
  const label = config?.label ?? "Context Block"
  const defaultContent = DEFAULT_CONTENT[blockType] ?? ""

  return {
    id: `context-${blockType}-${nodeIdCounter}-${Date.now()}`,
    type: "custom",
    position,
    data: {
      label,
      nodeType: blockType,
      blockType,
      content: defaultContent,
    },
  }
}

function updateContextNodeData(
  nodes: Node<ContextNodeData>[],
  nodeId: string,
  updates: Partial<Pick<ContextNodeData, "label" | "content">>,
): Node<ContextNodeData>[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      data: { ...node.data, ...updates },
    }
  })
}

function topologicalSort(
  nodes: Node<ContextNodeData>[],
  edges: Edge[],
): Node<ContextNodeData>[] {
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

  const sorted: Node<ContextNodeData>[] = []
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

  return [...unconnected, ...sorted]
}

function formatContextNode(node: Node<ContextNodeData>): string {
  const config = getContextBlockType(node.data.blockType)
  const header = config ? `[${config.label}]` : node.data.label
  const content = (node.data.content ?? "").trim()
  if (!content) return ""
  return `${header}\n${content}`
}

function generateContextPrompt(
  nodes: Node<ContextNodeData>[],
  edges: Edge[],
): string {
  if (nodes.length === 0) return ""
  const ordered = topologicalSort(nodes, edges)
  return ordered
    .map(formatContextNode)
    .filter((text) => text.length > 0)
    .join("\n\n")
}

const EXPLICIT_HEADER_REGEX = (() => {
  const labels = ALL_CONTEXT_BLOCK_TYPES.map((c) =>
    `[${c.label}]`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")
  return new RegExp(labels, "gi")
})()

const ROLE_END_MARKERS = [
  /you\s+will\s+be\s+provided/i,
  /you\s+will\s+output\s+a\s+score/i,
  /the\s+output\s+should\s+be/i,
]

const PROCESSING_END_MARKER = /the\s+output\s+should\s+be/i

const SCHEMA_END_MARKERS = [
  /here\s+is\s+a\s+list\s+of\s+attributes/i,
  /^attribute\s+1\s*:/im,
]

const INPUT_SOURCE_MARKERS = [
  /here\s+is\s+the\s+resume\s*:?\s*$/im,
  /here\s+is\s+the\s+resume\s*:?\s*\n/im,
  /here\s+is\s+the\s+resume\s*:/i,
]

const ATTRIBUTE_START_REGEX = /^attribute\s+\d+\s*:\s*.+$/gim

function findFirstMatch(text: string, patterns: RegExp[]): { index: number; length: number } | null {
  let best: { index: number; length: number } | null = null
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m.index !== undefined) {
      if (best === null || m.index < best.index) {
        best = { index: m.index, length: m[0].length }
      }
    }
  }
  return best
}

function parseWithExplicitHeaders(trimmed: string): {
  parts: { label: string; blockType: string; content: string }[]
} | null {
  const parts: { label: string; blockType: string; content: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null
  const regex = new RegExp(EXPLICIT_HEADER_REGEX.source, "gi")

  while ((match = regex.exec(trimmed)) !== null) {
    if (match.index > lastIndex) {
      const prevContent = trimmed.slice(lastIndex, match.index).trim()
      if (prevContent) {
        if (parts.length > 0) {
          parts[parts.length - 1].content = prevContent
        } else {
          parts.push({
            label: "Input Source",
            blockType: "input-source",
            content: prevContent,
          })
        }
      }
    }
    const header = match[0]
    const blockConfig = ALL_CONTEXT_BLOCK_TYPES.find(
      (c) => header.toLowerCase() === `[${c.label}]`.toLowerCase(),
    )
    if (blockConfig) {
      parts.push({
        label: blockConfig.label,
        blockType: blockConfig.id,
        content: "",
      })
    }
    lastIndex = match.index + match[0].length
  }

  if (parts.length === 0) return null

  if (lastIndex < trimmed.length) {
    const tail = trimmed.slice(lastIndex).trim()
    if (tail) parts[parts.length - 1].content = tail
  }

  return { parts }
}

function parseWithContentStructure(trimmed: string): {
  parts: { label: string; blockType: string; content: string }[]
} {
  const parts: { label: string; blockType: string; content: string }[] = []

  const roleEnd = findFirstMatch(trimmed, ROLE_END_MARKERS)
  const processingEnd = trimmed.match(PROCESSING_END_MARKER)
  const schemaEnd = findFirstMatch(trimmed, SCHEMA_END_MARKERS)
  const inputSourceMatch = findFirstMatch(trimmed, INPUT_SOURCE_MARKERS)

  const roleEndIdx = roleEnd?.index ?? trimmed.length
  const processingEndIdx = processingEnd?.index ?? trimmed.length
  const schemaEndIdx = schemaEnd?.index ?? trimmed.length
  const inputSourceIdx = inputSourceMatch?.index ?? trimmed.length

  if (roleEndIdx > 0) {
    const roleContent = trimmed.slice(0, roleEndIdx).trim()
    if (roleContent)
      parts.push({ label: "Role", blockType: "role", content: roleContent })
  }

  if (processingEnd && roleEnd && processingEndIdx > roleEndIdx) {
    const processingContent = trimmed
      .slice(roleEndIdx, processingEndIdx)
      .trim()
    if (processingContent) {
      parts.push({
        label: "Processing Rules",
        blockType: "processing-rules",
        content: processingContent,
      })
    }
  }

  if (processingEnd && schemaEndIdx > processingEndIdx) {
    const schemaContent = trimmed
      .slice(processingEndIdx, schemaEndIdx)
      .trim()
    if (schemaContent) {
      parts.push({
        label: "Output Schema",
        blockType: "output-schema",
        content: schemaContent,
      })
    }
  }

  const attributesStartIdx = schemaEndIdx < trimmed.length ? schemaEndIdx : processingEnd?.index ?? roleEndIdx
  const attributesEndIdx = inputSourceIdx
  const attributesSection =
    attributesEndIdx > attributesStartIdx
      ? trimmed.slice(attributesStartIdx, inputSourceIdx)
      : ""

  const attributeBlocks: { name: string; content: string }[] = []
  const attrMatches = [
    ...attributesSection.matchAll(new RegExp(ATTRIBUTE_START_REGEX.source, "gim")),
  ]

  for (let i = 0; i < attrMatches.length; i++) {
    const attrMatch = attrMatches[i]
    const startIdx = attrMatch.index!
    const header = attrMatch[0]
    const attrName = header.replace(/^attribute\s+\d+\s*:\s*/i, "").trim()
    const contentStart = startIdx + header.length
    const contentEnd =
      i < attrMatches.length - 1
        ? attrMatches[i + 1].index!
        : attributesSection.length
    const body = attributesSection.slice(contentStart, contentEnd).trim()
    const content = (header + "\n" + body).trim()
    attributeBlocks.push({ name: attrName || "Attribute", content })
  }

  if (attributeBlocks.length === 0 && attributesSection.trim()) {
    attributeBlocks.push({
      name: "Attribute",
      content: attributesSection.trim(),
    })
  }

  for (const block of attributeBlocks) {
    parts.push({
      label: block.name,
      blockType: "attribute",
      content: block.content,
    })
  }

  if (inputSourceIdx < trimmed.length) {
    const inputContent = trimmed.slice(inputSourceIdx).trim()
    if (inputContent) {
      parts.push({
        label: "Input Source",
        blockType: "input-source",
        content: inputContent,
      })
    }
  }

  if (parts.length === 0) {
    parts.push({
      label: "Input Source",
      blockType: "input-source",
      content: trimmed,
    })
  }

  return { parts }
}

function parseContextPromptToFlow(rawText: string): {
  nodes: Node<ContextNodeData>[]
  edges: Edge[]
} {
  const trimmed = rawText.trim()
  if (!trimmed) return { nodes: [], edges: [] }

  const result =
    parseWithExplicitHeaders(trimmed) ?? parseWithContentStructure(trimmed)
  const { parts } = result

  const nodes: Node<ContextNodeData>[] = parts.map((p, i) => ({
    id: `context-import-${p.blockType}-${i}-${Date.now()}`,
    type: "custom",
    position: { x: 100 + (i % 4) * 280, y: 100 + Math.floor(i / 4) * 120 },
    data: {
      label: p.label,
      nodeType: p.blockType,
      blockType: p.blockType,
      content: p.content,
    },
  }))

  const edges: Edge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
    })
  }

  return { nodes, edges }
}

export {
  createContextBlock,
  updateContextNodeData,
  generateContextPrompt,
  parseContextPromptToFlow,
}
export type { ContextNodeData }

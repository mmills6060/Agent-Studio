import type { Node, Edge } from "@xyflow/react"
import { createScoringBlock, type ScoringNodeData } from "./scoring-flow-canvas-handlers"

const ATTRIBUTE_HEADER_PATTERN =
  /^(.+?)\s*[–—-]\s*(\d+)\s*points?\s*\(([^)]+)\)\s*$/

const SECTION_HEADERS = [
  { pattern: /^what this indicator assesses$/i, blockType: "indicator-overview" },
  { pattern: /^important input:\s*(.+)$/i, blockType: "input-context" },
  { pattern: /^scoring scale with examples$/i, blockType: null },
  { pattern: /^scoring instructions\b/i, blockType: "scoring-instructions" },
  { pattern: /^evaluator guardrails$/i, blockType: "evaluator-guardrails" },
  { pattern: /^standardized output format$/i, blockType: "output-format" },
]

const LAYOUT = {
  baseX: 100,
  baseY: 200,
  blockWidth: 240,
  horizontalGap: 80,
} as const

interface ParsedAttribute {
  name: string
  maxPoints: number
  source: string
  goal: string
  scoringRules: string
  examples: string
}

function detectSectionHeader(line: string): { blockType: string | null; label?: string } | null {
  const trimmed = line.trim()
  for (const header of SECTION_HEADERS) {
    const match = trimmed.match(header.pattern)
    if (match) {
      return {
        blockType: header.blockType,
        label: match[1] && header.blockType === "input-context" ? match[1].trim() : undefined,
      }
    }
  }
  return null
}

function parseAttributeBlock(text: string): ParsedAttribute | null {
  const lines = text.split("\n")
  if (lines.length === 0) return null

  const headerMatch = lines[0].trim().match(ATTRIBUTE_HEADER_PATTERN)
  if (!headerMatch) return null

  const name = headerMatch[1].trim()
  const maxPoints = parseInt(headerMatch[2], 10)
  const source = headerMatch[3].trim()

  const body = lines.slice(1).join("\n").trim()

  let goal = ""
  let scoringRules = ""
  let examples = ""

  const goalMatch = body.match(/^Goal:\s*(.+)/m)
  if (goalMatch) goal = goalMatch[1].trim()

  const rulesStart = body.search(/^(?:Use these rules in order:|(?:\d+|[A-Z])\)\s)/m)
  const examplesStart = body.search(/^Examples?\s*(?:\(|:)/im)

  if (rulesStart !== -1) {
    const rulesEnd = examplesStart !== -1 ? examplesStart : body.length
    scoringRules = body.slice(rulesStart, rulesEnd).trim()
  }

  if (examplesStart !== -1) {
    examples = body.slice(examplesStart).trim()
    const firstNewline = examples.indexOf("\n")
    if (firstNewline !== -1) examples = examples.slice(firstNewline + 1).trim()
  }

  return { name, maxPoints, source, goal, scoringRules, examples }
}

function splitAttributeBlocks(text: string): string[] {
  const lines = text.split("\n")
  const blocks: string[] = []
  let currentBlock: string[] = []

  for (const line of lines) {
    if (line.trim().match(ATTRIBUTE_HEADER_PATTERN) && currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"))
      currentBlock = [line]
    } else {
      currentBlock.push(line)
    }
  }

  if (currentBlock.length > 0) blocks.push(currentBlock.join("\n"))
  return blocks
}

function parseScoringPrompt(text: string): {
  nodes: Node<ScoringNodeData>[]
  edges: Edge[]
} {
  const lines = text.split("\n")
  const allNodes: Node<ScoringNodeData>[] = []
  const topLevelIds: string[] = []
  let currentX = LAYOUT.baseX

  function addNode(blockType: string, data: Partial<ScoringNodeData>): void {
    const node = createScoringBlock(blockType, { x: currentX, y: LAYOUT.baseY })
    Object.assign(node.data, data)
    allNodes.push(node)
    topLevelIds.push(node.id)
    currentX += LAYOUT.blockWidth + LAYOUT.horizontalGap
  }

  interface RawSection {
    blockType: string | null
    label?: string
    content: string
  }

  const sections: RawSection[] = []
  let currentSection: RawSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const detected = detectSectionHeader(line.trim())

    if (detected) {
      if (currentSection) sections.push(currentSection)
      currentSection = {
        blockType: detected.blockType,
        label: detected.label,
        content: "",
      }
      continue
    }

    if (currentSection) {
      currentSection.content += (currentSection.content ? "\n" : "") + line
    }
  }
  if (currentSection) sections.push(currentSection)

  if (sections.length === 0) return { nodes: [], edges: [] }

  for (const section of sections) {
    const content = section.content.trim()

    if (section.blockType === null) {
      const attrBlocks = splitAttributeBlocks(content)
      for (const block of attrBlocks) {
        const parsed = parseAttributeBlock(block.trim())
        if (!parsed) continue
        addNode("scoring-attribute", {
          label: parsed.name,
          maxPoints: parsed.maxPoints,
          source: parsed.source,
          goal: parsed.goal,
          scoringRules: parsed.scoringRules,
          examples: parsed.examples,
        })
      }
      continue
    }

    if (section.blockType === "input-context") {
      addNode(section.blockType, {
        label: section.label ?? "Input Context",
        content,
      })
      continue
    }

    addNode(section.blockType, { content })
  }

  const edges: Edge[] = []
  for (let i = 0; i < topLevelIds.length - 1; i++) {
    edges.push({
      id: `edge-${topLevelIds[i]}-${topLevelIds[i + 1]}`,
      source: topLevelIds[i],
      target: topLevelIds[i + 1],
    })
  }

  return { nodes: allNodes, edges }
}

export { parseScoringPrompt }

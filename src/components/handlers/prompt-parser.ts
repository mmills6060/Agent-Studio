import type { Node, Edge } from "@xyflow/react"
import { createTypedBlock, type CustomNodeData } from "./flow-canvas-handlers"
import { getBlockTypeByTag } from "@/lib/block-types"

interface ParsedBlock {
  tag: string
  tagContent: string
  content: string
  blockTypeId: string
}

interface ParsedQuestion {
  question: string
  followUpStrategy: string
}

const TOP_LEVEL_TAG_PATTERN =
  /^\[(PERSONA|JOB INFO|RULES|SCENARIO|INSTRUCTIONS|SECTION\s*[\d]*\s*:?[^\]]*|FAQ|GLOBAL CONSTRAINT)\]/gm

const SECTION_INNER_TAG_PATTERN =
  /\[(SYSTEM INSTRUCTION|CURRENT QUESTION|FOLLOW-UP STRATEGY)\]/g

const LAYOUT = {
  baseX: 100,
  baseY: 200,
  simpleBlockWidth: 220,
  sectionWidth: 460,
  horizontalGap: 80,
  sectionBaseHeight: 260,
  questionHeight: 90,
  questionYStart: 110,
  minSectionHeight: 400,
} as const

function splitIntoTopLevelBlocks(text: string): ParsedBlock[] {
  const matches = [...text.matchAll(TOP_LEVEL_TAG_PATTERN)]
  if (matches.length === 0) return []

  const blocks: ParsedBlock[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const fullTag = `[${match[1]}]`
    const startIdx = match.index! + match[0].length
    const endIdx =
      i < matches.length - 1 ? matches[i + 1].index! : text.length
    const content = text.slice(startIdx, endIdx).trim()

    const config = getBlockTypeByTag(fullTag)
    if (!config) continue

    blocks.push({
      tag: fullTag,
      tagContent: match[1],
      content,
      blockTypeId: config.id,
    })
  }

  return blocks
}

function extractSectionLabel(tagContent: string): string {
  const colonIdx = tagContent.indexOf(":")
  if (colonIdx === -1) return "Section"
  return tagContent.slice(colonIdx + 1).trim()
}

function stripQuotes(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"'))
    return trimmed.slice(1, -1).trim()
  return trimmed
}

function parseSectionBody(content: string): {
  systemInstruction: string
  questions: ParsedQuestion[]
} {
  const matches = [...content.matchAll(new RegExp(SECTION_INNER_TAG_PATTERN))]

  if (matches.length === 0)
    return { systemInstruction: content.trim(), questions: [] }

  let systemInstruction = ""
  const questions: ParsedQuestion[] = []

  for (let i = 0; i < matches.length; i++) {
    const tagType = matches[i][1]
    const startIdx = matches[i].index! + matches[i][0].length
    const endIdx =
      i < matches.length - 1 ? matches[i + 1].index! : content.length
    const tagContent = content.slice(startIdx, endIdx).trim()

    if (tagType === "SYSTEM INSTRUCTION") {
      systemInstruction = tagContent
    } else if (tagType === "CURRENT QUESTION") {
      questions.push({
        question: stripQuotes(tagContent),
        followUpStrategy: "",
      })
    } else if (tagType === "FOLLOW-UP STRATEGY" && questions.length > 0) {
      questions[questions.length - 1].followUpStrategy = tagContent
    }
  }

  return { systemInstruction, questions }
}

function parsePromptToFlow(text: string): {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
} {
  const blocks = splitIntoTopLevelBlocks(text)
  if (blocks.length === 0) return { nodes: [], edges: [] }

  const allNodes: Node<CustomNodeData>[] = []
  const edges: Edge[] = []
  const topLevelIds: string[] = []
  let currentX = LAYOUT.baseX

  for (const block of blocks) {
    if (block.blockTypeId === "section") {
      const sectionLabel = extractSectionLabel(block.tagContent)
      const { systemInstruction, questions } = parseSectionBody(block.content)

      const sectionHeight = Math.max(
        LAYOUT.minSectionHeight,
        LAYOUT.sectionBaseHeight + questions.length * LAYOUT.questionHeight,
      )

      const sectionNode = createTypedBlock("section", {
        x: currentX,
        y: LAYOUT.baseY,
      })
      sectionNode.data.label = sectionLabel
      sectionNode.data.content = systemInstruction
      sectionNode.style = { width: LAYOUT.sectionWidth, height: sectionHeight }

      allNodes.push(sectionNode)
      topLevelIds.push(sectionNode.id)

      const questionIds: string[] = []
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi]
        const questionNode = createTypedBlock(
          "question",
          { x: 20, y: LAYOUT.questionYStart + qi * LAYOUT.questionHeight },
          sectionNode.id,
        )
        questionNode.data.label = `Question ${qi + 1}`
        questionNode.data.content = q.question
        questionNode.data.followUpStrategy = q.followUpStrategy
        allNodes.push(questionNode)
        questionIds.push(questionNode.id)
      }

      for (let qi = 0; qi < questionIds.length - 1; qi++) {
        edges.push({
          id: `edge-${questionIds[qi]}-${questionIds[qi + 1]}`,
          source: questionIds[qi],
          target: questionIds[qi + 1],
        })
      }

      currentX += LAYOUT.sectionWidth + LAYOUT.horizontalGap
    } else {
      const node = createTypedBlock(block.blockTypeId, {
        x: currentX,
        y: LAYOUT.baseY,
      })
      node.data.content = block.content
      allNodes.push(node)
      topLevelIds.push(node.id)
      currentX += LAYOUT.simpleBlockWidth + LAYOUT.horizontalGap
    }
  }

  for (let i = 0; i < topLevelIds.length - 1; i++) {
    edges.push({
      id: `edge-${topLevelIds[i]}-${topLevelIds[i + 1]}`,
      source: topLevelIds[i],
      target: topLevelIds[i + 1],
    })
  }

  return { nodes: allNodes, edges }
}

export { parsePromptToFlow }

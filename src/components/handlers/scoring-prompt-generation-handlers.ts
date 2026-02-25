import type { Node, Edge } from "@xyflow/react"
import type { CustomNodeData } from "./flow-canvas-handlers"
import { createScoringBlock, type ScoringNodeData } from "./scoring-flow-canvas-handlers"

interface SectionContent {
  label: string
  systemInstruction: string
  questions: { question: string; followUpStrategy: string; label: string }[]
}

function collectSectionContent(
  nodes: Node<CustomNodeData>[],
  sectionId: string,
): SectionContent | null {
  const section = nodes.find((n) => n.id === sectionId)
  if (!section || section.data.blockType !== "section") return null

  const children = nodes
    .filter((n) => n.parentId === sectionId && n.data.blockType === "question")
    .sort((a, b) => a.position.y - b.position.y)

  const questions = children
    .filter((c) => c.data.content?.trim())
    .map((c) => ({
      label: c.data.label?.trim() || "Question",
      question: c.data.content.trim(),
      followUpStrategy: c.data.followUpStrategy?.trim() ?? "",
    }))

  return {
    label: section.data.label ?? "Section",
    systemInstruction: section.data.content?.trim() ?? "",
    questions,
  }
}

function toSnakeCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

async function generateAttributeKeys(
  sectionLabel: string,
  questions: { label: string; question: string }[],
): Promise<string[]> {
  const response = await fetch("/api/generate-attribute-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionLabel, questions }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? "Failed to generate attribute keys")
  }

  const data = await response.json()
  return data.keys as string[]
}

const LAYOUT = {
  baseX: 100,
  baseY: 200,
  blockWidth: 240,
  horizontalGap: 80,
} as const

function formatPossibleValues(levels: { value: number }[]): string {
  const sorted = [...levels].sort((a, b) => a.value - b.value)
  const values = sorted.map((l) => String(l.value))
  if (values.length <= 2) return values.join(" or ")
  return values.slice(0, -1).join(", ") + ", or " + values[values.length - 1]
}

function buildScoringNodesFromSection(
  sectionContent: SectionContent,
  attributeKeys?: string[],
): { nodes: Node<ScoringNodeData>[]; edges: Edge[] } {
  const allNodes: Node<ScoringNodeData>[] = []
  let currentX = LAYOUT.baseX

  function addNode(blockType: string, data: Partial<ScoringNodeData>): Node<ScoringNodeData> {
    const node = createScoringBlock(blockType, { x: currentX, y: LAYOUT.baseY })
    Object.assign(node.data, data)
    allNodes.push(node)
    currentX += LAYOUT.blockWidth + LAYOUT.horizontalGap
    return node
  }

  const { label, systemInstruction, questions } = sectionContent

  const overviewLines = [`Evaluates candidate responses in the "${label}" section.`]
  if (systemInstruction) overviewLines.push(systemInstruction)
  if (questions.length > 0) {
    overviewLines.push(`\nCovers ${questions.length} question${questions.length > 1 ? "s" : ""}:`)
    questions.forEach((q, i) => overviewLines.push(`${i + 1}. ${q.question}`))
  }

  addNode("indicator-overview", {
    label: `${label} Overview`,
    content: overviewLines.join("\n"),
  })

  const resolvedKeys: string[] = []
  const resolvedLevels: { value: number }[][] = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const attrKey = attributeKeys?.[i] ?? toSnakeCase(q.label)
    resolvedKeys.push(attrKey)

    const scoreLevels = [
      { value: 3, description: "Comprehensive, well-structured response demonstrating strong understanding", examples: [] as string[] },
      { value: 2, description: "Adequate response covering key points with minor gaps", examples: [] as string[] },
      { value: 1, description: "Partial response with significant gaps or lack of depth", examples: [] as string[] },
      { value: 0, description: "No meaningful response or completely off-topic", examples: [] as string[] },
    ]
    resolvedLevels.push(scoreLevels)

    addNode("scoring-attribute", {
      label: q.label,
      maxPoints: 3,
      source: "transcript",
      goal: q.question,
      scoringRules: q.followUpStrategy
        ? `Evaluate the candidate's response to: "${q.question}"\n\nFollow-up context: ${q.followUpStrategy}`
        : `Evaluate the candidate's response to: "${q.question}"`,
      attributeKey: attrKey,
      scoreLevels,
    })
  }

  const instructionLines = [
    "1. Read the full conversation transcript carefully",
    "2. For each scoring attribute, identify relevant candidate responses",
    "3. Compare responses against the scoring scale",
    "4. Assign a score for each attribute based on the evidence",
    "5. Write a brief rationale summarizing key observations from the transcript",
    "",
    "Score each attribute independently:",
  ]
  resolvedKeys.forEach((key, i) => {
    instructionLines.push(`"${key}": <${formatPossibleValues(resolvedLevels[i])}>`)
  })

  addNode("scoring-instructions", {
    label: "Scoring Instructions",
    content: instructionLines.join("\n"),
  })

  addNode("evaluator-guardrails", {
    label: "Evaluator Guardrails",
    content: [
      "- Score only what the candidate explicitly states in the transcript",
      "- Do not infer knowledge the candidate did not demonstrate",
      "- Do not penalize for interview style or communication preferences",
      "- Apply scoring criteria consistently across all candidates",
      "- If a question was not asked or not answered, score it as 0",
      "- Provide evidence from the transcript for each score assigned",
    ].join("\n"),
  })

  const labelList = questions.map((q) => q.label.toLowerCase()).join(" and ")
  const attributeFields = resolvedKeys
    .map((key, i) => `"${key}": <${formatPossibleValues(resolvedLevels[i])}>`)
    .join(", ")

  addNode("output-format", {
    label: "Output Format",
    content: `{"rationale": "<up to 50 words summarizing ${labelList} responses — facts only>", "attribute_scores": {${attributeFields}}}`,
  })

  const edges: Edge[] = []
  for (let i = 0; i < allNodes.length - 1; i++) {
    edges.push({
      id: `edge-${allNodes[i].id}-${allNodes[i + 1].id}`,
      source: allNodes[i].id,
      target: allNodes[i + 1].id,
    })
  }

  return { nodes: allNodes, edges }
}

export { collectSectionContent, buildScoringNodesFromSection, generateAttributeKeys }
export type { SectionContent }

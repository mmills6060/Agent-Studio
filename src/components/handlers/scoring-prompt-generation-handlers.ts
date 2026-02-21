import type { Node } from "@xyflow/react"
import type { CustomNodeData } from "./flow-canvas-handlers"

interface SectionContent {
  label: string
  systemInstruction: string
  questions: { question: string; followUpStrategy: string }[]
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
      question: c.data.content.trim(),
      followUpStrategy: c.data.followUpStrategy?.trim() ?? "",
    }))

  return {
    label: section.data.label ?? "Section",
    systemInstruction: section.data.content?.trim() ?? "",
    questions,
  }
}

async function generateScoringPromptFromSection(
  sectionContent: SectionContent,
): Promise<string> {
  const response = await fetch("/api/generate-scoring-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sectionContent),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(err.error ?? `API returned ${response.status}`)
  }

  const data = await response.json()
  return data.result as string
}

export { collectSectionContent, generateScoringPromptFromSection }
export type { SectionContent }

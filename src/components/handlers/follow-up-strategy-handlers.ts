import type { Node } from "@xyflow/react"
import type { CustomNodeData } from "@/components/handlers/flow-canvas-handlers"

interface FollowUpContext {
  question: string
  sectionLabel: string
  systemInstruction: string
  siblingQuestions: string[]
}

function gatherFollowUpContext(
  nodes: Node<CustomNodeData>[],
  questionNodeId: string,
): FollowUpContext | null {
  const questionNode = nodes.find((n) => n.id === questionNodeId)
  if (!questionNode) return null

  const question = questionNode.data.content?.trim() ?? ""
  if (!question) return null

  const parentId = questionNode.parentId
  const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null

  const sectionLabel = parentNode?.data.label?.trim() ?? ""
  const systemInstruction = parentNode?.data.content?.trim() ?? ""

  const siblingQuestions = parentId
    ? nodes
        .filter((n) => n.parentId === parentId && n.id !== questionNodeId)
        .map((n) => n.data.content?.trim())
        .filter((q): q is string => !!q)
    : []

  return { question, sectionLabel, systemInstruction, siblingQuestions }
}

async function generateFollowUpStrategy(
  nodes: Node<CustomNodeData>[],
  questionNodeId: string,
): Promise<string> {
  const context = gatherFollowUpContext(nodes, questionNodeId)
  if (!context) throw new Error("Could not gather context for the question")

  const response = await fetch("/api/generate-follow-up-strategy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? `API returned ${response.status}`)
  }

  const data = await response.json()
  return data.strategy as string
}

export { generateFollowUpStrategy, gatherFollowUpContext }

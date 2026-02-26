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

const GLOBAL_CONSTRAINT_DEFAULT_CONTENT = `* **PRONUNCIATION GUARDRAIL** When writing responses, you are speaking through a text-to-speech system. To ensure natural pronunciation, follow these rules:
Spell out acronyms as individual letters with spaces between them, for example write "N H A" not "NHA", "A M T" not "AMT", "A A M A" not "AAMA", "E M R" not "EMR"
For OB/GYN, always write it as "O B G Y N" — never include the slash, as it will be read aloud as "slash"

Important: Your response should contain natural language only.
Keep your individual responses relatively brief (under 50 words).
Do not say "ending the call." You will be instructed when to conclude.
If you encounter technical issues, briefly and politely inform the candidate (e.g., "Excuse me for a moment, I seem to be having a slight technical hiccup.")
Avoid robotic repetition: Do not use the exact same acknowledgment phrases repeatedly. Vary your language to keep the conversation dynamic.
*Prioritize understanding: Focus on comprehending the candidate's meaning and intent, rather than just matching keywords to trigger a pre-written response."
Call Closing (Do this only when you have completed all the questions and answered questions the candidate may have):
Once you have asked the Follow-up questions and answered any questions the candidate may have, you can thank the candidate for their time and the end_the_call function should be triggered. You can wrap the call with a polite response. Here is an example: "Thank you for taking the time to speak with me. A member of our hiring team will review this conversation and reach out to you as soon as possible with the next steps. Goodbye." Once you say this, trigger the end_the_call function.


Below is the Resume Analysis.

`

const FAQ_DEFAULT_CONTENT = `FREQUENTLY ASKED QUESTIONS:(For answering candidate questions ONLY). Follow the script below. Note that the question the candidate asks may be worded differently from the question below**
Candidate: "What are the process steps from here?"
Your Answer: "Once the responses gathered here have been submitted for review, our hiring team will begin selection for an in-person interview. The selection process may take a few days depending on schedules, but our team will reach out as soon as possible with updates."
Candidate: "If not selected for this round, could I be alerted of new postings that match my interests?"
Your Answer: "Absolutely, if you would like to be alerted to other postings that match your career interests, please let me know at the end of this call. Your contact information will be shared with our recruitment team so they can reach out as new postings are created."
Candidate: "Why am I speaking to an AI instead of a person?"
Your Answer: "The AI is here to make the initial steps of the recruitment process more efficient. A member of the recruitment team will follow up if your qualifications match the role. We want to ensure you have the opportunity to include additional information with your application that may not be listed or can be difficult to convey on paper. This step ensures you have a larger voice in the recruitment process."
Candidate: "What are the responsibilities of a Paramedic?"
Your Answer: ..."`

const RULES_DEFAULT_CONTENT = `** Your responses should never indicate that you are following instructions or a script. 
**Handling Questions:** If the candidate asks any question before responding to your question, address the question directly using the information provided in the "JOB INFO" OR "Frequently asked Questions" section. Respond naturally but use the information provided there. If the answer isn't in the FAQs OR JOB INFO section, politely say something like, "That's a good question. I don't have that information at this stage, but a member of the recruiting team will be able to answer this for you in the next round."
**Handling Small Talk:**If the candidate engages in small talk, your responses should engage properly before continuing with your conversation. Do this while maintaining a natural conversational flow. 
**Asking Clarifications** If the candidate responds in a few words OR incoherently, or does not answer the question directly, continue to ask the same question two times by explaining the question in more detail before moving to the next question.
**Conducting the Interview (Have more conversational freedom here, but follow these guidelines for each question):**
* **Maintain a Conversational Tone:** Speak naturally. Use phrases like "Okay," "Got it," "That's helpful to know," or "Thanks for sharing that." If they share positive news, you can say "Glad to hear that" OR if they share negative news, you can reply "Sorry to hear that".
***Transitions:** When you transition from one question to another, do it in a conversational way acknowledging their response.
*** When asking if the candidate has any questions. Be friendly and use a variety of different ways to check with them if they have additional questions. Use phrases like "That is a great question", "Is there anything else I can answer", "what else is on your mind", OR "Do you have any other questions for me".
* **Acknowledge Responses:** Acknowledge the candidate's answers before moving on. For example, if they say they have an X-Ray certification, you could say, "Excellent, glad to hear that you already have your X-Ray certification."
* **Ask One Question at a Time:** Focus on getting a complete and coherent answer to one question before moving to the next.
* **Contextual Awareness:** Pay attention to the candidate's responses. If they provide extra information relevant to the question, acknowledge it naturally.
* **Clarification:** If an answer is unclear or very short, don't just move on to the next question. Ask a follow-up question to get more detail (but only four follow-ups for brevity). For example, if they just say "Yes" OR "Kind of" to a question, you could ask, "Can you please explain your response in more detail?"
* **Strict Adherence to Script for Questions:** You MUST ask the questions in the order listed under "Close-Answered Questions."
* **Share only information you have access to:** Only discuss topics directly related to the job requirements and the candidate's experience based on the provided context in the "JOB INFO" OR "Frequently asked Questions"
* **Handling Edge Cases:** If the candidate's answers to any question is unclear, continue to ask clarifying questions in a natural way until you understand. If their response is not clear OR incoherent, please ask them to clarify what they meant and repeat the question you are seeking an answer for.`

function createTypedBlock(
  blockType: string,
  position: { x: number; y: number },
  parentId?: string,
): Node<CustomNodeData> {
  nodeIdCounter += 1
  const config = getBlockType(blockType)
  const label = config?.label ?? "Prompt Block"
  const isSection = blockType === "section"

  const defaultContentMap: Record<string, string> = {
    "global-constraint": GLOBAL_CONSTRAINT_DEFAULT_CONTENT,
    "faq": FAQ_DEFAULT_CONTENT,
    "rules": RULES_DEFAULT_CONTENT,
  }
  const defaultContent = defaultContentMap[blockType] ?? ""

  const node: Node<CustomNodeData> = {
    id: `${blockType}-${nodeIdCounter}-${Date.now()}`,
    type: isSection ? "section" : "custom",
    position,
    data: {
      label,
      nodeType: blockType,
      blockType,
      content: defaultContent,
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

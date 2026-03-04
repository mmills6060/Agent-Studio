import Papa from "papaparse"
import type { Node, Edge } from "@xyflow/react"
import { createTypedBlock, coerceToString, generateSystemPrompt, type CustomNodeData } from "./flow-canvas-handlers"
import { createScoringBlock, generateScoringPrompt, type ScoringNodeData } from "./scoring-flow-canvas-handlers"
import { generateAttributeKeys } from "./scoring-prompt-generation-handlers"
import { createJobRole } from "./job-roles-handlers"
import { createCriteriaNode } from "./create-criteria-node-handlers"

interface SpreadsheetRow {
  category: string
  question: string
  points: number
  scoringGuidance: string
}

interface CategoryGroup {
  name: string
  questions: SpreadsheetRow[]
}

interface WizardConfig {
  interviewerName: string
  companyName: string
  roleTitle: string
  aboutCompany: string
  aboutRole: string
  selectedOrganizationId: string | null
  categories: CategoryGroup[]
}

interface WizardGeneratedContent {
  categories: {
    name: string
    systemInstruction: string
    questions: {
      followUpStrategy: string
      scoreLevels: { value: number; description: string }[]
    }[]
  }[]
}

interface WizardCallPromptResult {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
}

interface WizardScoringResult {
  tabName: string
  nodes: Node<ScoringNodeData>[]
  edges: Edge[]
  criteriaDefinition: WizardCriteriaDefinition
}

interface WizardCriteriaDefinition {
  criteriaName: string
  minScore: number
  maxScore: number
}

interface WizardPersistenceResult {
  organizationId: string
  roleId: string
  promptId: string
}

interface WizardResult {
  callPrompt: WizardCallPromptResult
  scoringPrompts: WizardScoringResult[]
  persisted: WizardPersistenceResult | null
  persistenceError: string | null
}

const REQUIRED_COLUMNS = ["category", "question", "points", "scoring guidance"]

function normalizeColumnName(col: string): string {
  return col.trim().toLowerCase().replace(/_/g, " ")
}

function parseCSV(file: File): Promise<SpreadsheetRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (!results.data || results.data.length === 0) {
          reject(new Error("CSV file is empty"))
          return
        }

        const rawHeaders = results.meta.fields ?? []
        const headerMap = new Map<string, string>()
        for (const h of rawHeaders) {
          headerMap.set(normalizeColumnName(h), h)
        }

        const missing = REQUIRED_COLUMNS.filter((col) => !headerMap.has(col))
        if (missing.length > 0) {
          reject(new Error(`Missing required columns: ${missing.join(", ")}`))
          return
        }

        const categoryCol = headerMap.get("category")!
        const questionCol = headerMap.get("question")!
        const pointsCol = headerMap.get("points")!
        const guidanceCol = headerMap.get("scoring guidance")!

        const rows: SpreadsheetRow[] = []
        for (const raw of results.data as Record<string, string>[]) {
          const category = raw[categoryCol]?.trim()
          const question = raw[questionCol]?.trim()
          if (!category || !question) continue

          rows.push({
            category,
            question,
            points: parseFloat(raw[pointsCol]) || 0,
            scoringGuidance: raw[guidanceCol]?.trim() ?? "",
          })
        }

        if (rows.length === 0) {
          reject(new Error("No valid rows found in CSV"))
          return
        }

        resolve(rows)
      },
      error(err) {
        reject(new Error(`Failed to parse CSV: ${err.message}`))
      },
    })
  })
}

function groupByCategory(rows: SpreadsheetRow[]): CategoryGroup[] {
  const grouped = new Map<string, SpreadsheetRow[]>()

  for (const row of rows) {
    const existing = grouped.get(row.category) ?? []
    existing.push(row)
    grouped.set(row.category, existing)
  }

  return Array.from(grouped.entries()).map(([name, questions]) => ({
    name,
    questions,
  }))
}

async function fetchWizardContent(
  config: WizardConfig,
): Promise<WizardGeneratedContent> {
  const response = await fetch("/api/generate-wizard-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interviewerName: config.interviewerName,
      companyName: config.companyName,
      roleTitle: config.roleTitle,
      categories: config.categories.map((cat) => ({
        name: cat.name,
        questions: cat.questions.map((q) => ({
          question: q.question,
          points: q.points,
          scoringGuidance: q.scoringGuidance,
        })),
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? "Failed to generate wizard content")
  }

  return response.json()
}

const CALL_LAYOUT = {
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

function substituteWizardValues(
  template: string,
  config: WizardConfig,
): string {
  return template
    .replaceAll("Melissa", config.interviewerName)
    .replaceAll("Affordable Care", config.companyName)
    .replaceAll("Front Desk Assistant", config.roleTitle)
}

function buildJobInfoContent(config: WizardConfig): string {
  return `This is information regarding the job that you will need to know to handle any questions the candidate asks.

<POSITION_CONTEXT>

*About the company: ${config.aboutCompany}

*About the role: ${config.aboutRole}
</POSITION_CONTEXT>`
}

function buildCallPromptNodes(
  config: WizardConfig,
  content: WizardGeneratedContent,
): WizardCallPromptResult {
  const allNodes: Node<CustomNodeData>[] = []
  const topLevelIds: string[] = []
  let currentX = CALL_LAYOUT.baseX

  function addBlock(blockType: string) {
    const node = createTypedBlock(blockType, { x: currentX, y: CALL_LAYOUT.baseY })
    allNodes.push(node)
    topLevelIds.push(node.id)
    currentX += CALL_LAYOUT.simpleBlockWidth + CALL_LAYOUT.horizontalGap
    return node
  }

  const personaNode = addBlock("persona")
  personaNode.data.content = substituteWizardValues(personaNode.data.content, config)

  const jobInfoNode = addBlock("job-info")
  jobInfoNode.data.content = buildJobInfoContent(config)

  addBlock("rules")
  addBlock("instructions")

  for (let ci = 0; ci < config.categories.length; ci++) {
    const cat = config.categories[ci]
    const catContent = content.categories[ci]
    const questions = cat.questions

    const sectionHeight = Math.max(
      CALL_LAYOUT.minSectionHeight,
      CALL_LAYOUT.sectionBaseHeight + questions.length * CALL_LAYOUT.questionHeight,
    )

    const sectionNode = createTypedBlock("section", {
      x: currentX,
      y: CALL_LAYOUT.baseY,
    })
    sectionNode.data.label = cat.name
    sectionNode.data.content = catContent?.systemInstruction ?? ""
    sectionNode.style = { width: CALL_LAYOUT.sectionWidth, height: sectionHeight }

    allNodes.push(sectionNode)
    topLevelIds.push(sectionNode.id)

    const questionIds: string[] = []
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi]
      const questionNode = createTypedBlock(
        "question",
        { x: 20, y: CALL_LAYOUT.questionYStart + qi * CALL_LAYOUT.questionHeight },
        sectionNode.id,
      )
      questionNode.data.label = `Question ${qi + 1}`
      questionNode.data.content = q.question
      questionNode.data.followUpStrategy =
        coerceToString(catContent?.questions[qi]?.followUpStrategy)
      allNodes.push(questionNode)
      questionIds.push(questionNode.id)
    }

    for (let qi = 0; qi < questionIds.length - 1; qi++) {
      // question edges are added in the edges array below
    }

    currentX += CALL_LAYOUT.sectionWidth + CALL_LAYOUT.horizontalGap
  }

  addBlock("faq")
  addBlock("global-constraint")

  const edges: Edge[] = []

  for (let i = 0; i < topLevelIds.length - 1; i++) {
    edges.push({
      id: `edge-${topLevelIds[i]}-${topLevelIds[i + 1]}`,
      source: topLevelIds[i],
      target: topLevelIds[i + 1],
    })
  }

  const sectionNodes = allNodes.filter((n) => n.data.blockType === "section")
  for (const section of sectionNodes) {
    const children = allNodes
      .filter((n) => n.parentId === section.id)
      .sort((a, b) => a.position.y - b.position.y)

    for (let i = 0; i < children.length - 1; i++) {
      edges.push({
        id: `edge-${children[i].id}-${children[i + 1].id}`,
        source: children[i].id,
        target: children[i + 1].id,
      })
    }
  }

  return { nodes: allNodes, edges }
}

const SCORING_LAYOUT = {
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

function buildScoringForCategory(
  category: CategoryGroup,
  generatedContent: WizardGeneratedContent["categories"][number],
  attributeKeys: string[],
): WizardScoringResult {
  const allNodes: Node<ScoringNodeData>[] = []
  let currentX = SCORING_LAYOUT.baseX

  function addNode(blockType: string, data: Partial<ScoringNodeData>): Node<ScoringNodeData> {
    const node = createScoringBlock(blockType, { x: currentX, y: SCORING_LAYOUT.baseY })
    Object.assign(node.data, data)
    allNodes.push(node)
    currentX += SCORING_LAYOUT.blockWidth + SCORING_LAYOUT.horizontalGap
    return node
  }

  const overviewLines = [`Evaluates candidate responses in the "${category.name}" section.`]
  if (generatedContent.systemInstruction)
    overviewLines.push(generatedContent.systemInstruction)
  if (category.questions.length > 0) {
    overviewLines.push(`\nCovers ${category.questions.length} question${category.questions.length > 1 ? "s" : ""}:`)
    category.questions.forEach((q, i) => overviewLines.push(`${i + 1}. ${q.question}`))
  }

  addNode("indicator-overview", {
    label: `${category.name} Overview`,
    content: overviewLines.join("\n"),
  })

  const resolvedKeys: string[] = []
  const resolvedLevels: { value: number }[][] = []

  for (let i = 0; i < category.questions.length; i++) {
    const q = category.questions[i]
    const attrKey = attributeKeys[i] ?? q.question.toLowerCase().replace(/\s+/g, "_").slice(0, 30)
    resolvedKeys.push(attrKey)

    const genQuestion = generatedContent.questions[i]
    const maxPoints = q.points

    const scoreLevels = genQuestion?.scoreLevels?.length > 0
      ? genQuestion.scoreLevels.map((sl) => ({ ...sl, examples: [] as string[] }))
      : buildDefaultScoreLevels(maxPoints, q.scoringGuidance)

    resolvedLevels.push(scoreLevels)

    addNode("scoring-attribute", {
      label: `Question ${i + 1}`,
      maxPoints,
      source: "transcript",
      goal: q.question,
      scoringRules: q.scoringGuidance
        ? `Evaluate the candidate's response to: "${q.question}"\n\nScoring guidance: ${q.scoringGuidance}`
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

  const labelList = category.questions.map((_, i) => `question ${i + 1}`).join(" and ")
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

  const categoryMaxScore = category.questions.reduce((total, question) => {
    const boundedPoints = Number.isFinite(question.points) ? Math.max(0, question.points) : 0
    return total + boundedPoints
  }, 0)
  const criteriaDefinition = {
    criteriaName: buildCriteriaName(category.name),
    minScore: 0,
    maxScore: categoryMaxScore,
  }

  return {
    tabName: `${category.name} Scoring`,
    nodes: allNodes,
    edges,
    criteriaDefinition,
  }
}

function buildCriteriaName(categoryName: string): string {
  const compactCategoryName = categoryName.trim() || "Category"
  if (compactCategoryName.length <= 120)
    return compactCategoryName
  return compactCategoryName.slice(0, 117) + "..."
}

async function persistWizardArtifacts(
  config: WizardConfig,
  result: Omit<WizardResult, "persisted">,
  onProgress?: (step: string) => void,
): Promise<WizardPersistenceResult> {
  const organizationId = config.selectedOrganizationId?.trim() ?? ""
  if (!organizationId)
    throw new Error("Organization selection is required for persistence")

  onProgress?.("Saving role and call prompt under selected organization...")
  const callPromptString = generateSystemPrompt(result.callPrompt.nodes, result.callPrompt.edges)
  const createdRole = await createJobRole({
    orgId: organizationId,
    roleDescription: config.roleTitle.trim(),
    assessmentInstanceName: config.roleTitle.trim(),
    promptString: callPromptString,
  })

  const roleId = createdRole.roleId
  const promptId = createdRole.promptId
  if (!promptId)
    throw new Error("Created role is missing promptId")

  for (let categoryIndex = 0; categoryIndex < result.scoringPrompts.length; categoryIndex++) {
    const scoringPrompt = result.scoringPrompts[categoryIndex]
    const scoringPromptText = generateScoringPrompt(scoringPrompt.nodes, scoringPrompt.edges)
    onProgress?.(`Saving scoring criteria for "${config.categories[categoryIndex]?.name ?? scoringPrompt.tabName}"...`)

    await createCriteriaNode({
      roleId,
      promptId,
      criteriaName: scoringPrompt.criteriaDefinition.criteriaName,
      minScore: scoringPrompt.criteriaDefinition.minScore,
      maxScore: scoringPrompt.criteriaDefinition.maxScore,
      scoringPrompt: scoringPromptText,
    })
  }

  return {
    organizationId,
    roleId,
    promptId,
  }
}

function buildDefaultScoreLevels(
  maxPoints: number,
  guidance: string,
): { value: number; description: string; examples: string[] }[] {
  const levels: { value: number; description: string; examples: string[] }[] = []
  for (let v = maxPoints; v >= 0; v--) {
    const ratio = maxPoints > 0 ? v / maxPoints : 0
    let description: string
    if (ratio === 1) description = `Full marks — ${guidance || "Comprehensive, well-structured response"}`
    else if (ratio >= 0.66) description = "Strong response covering most key points"
    else if (ratio >= 0.33) description = "Partial response with notable gaps"
    else if (v === 0) description = "No meaningful response or not addressed"
    else description = "Minimal response with significant gaps"
    levels.push({ value: v, description, examples: [] })
  }
  return levels
}

async function runWizard(
  config: WizardConfig,
  onProgress?: (step: string) => void,
): Promise<WizardResult> {
  onProgress?.("Generating prompt content with AI...")
  const content = await fetchWizardContent(config)

  onProgress?.("Building call prompt...")
  const callPrompt = buildCallPromptNodes(config, content)

  const scoringPrompts: WizardScoringResult[] = []

  for (let i = 0; i < config.categories.length; i++) {
    const cat = config.categories[i]
    const catContent = content.categories[i]
    onProgress?.(`Generating scoring prompt for "${cat.name}"...`)

    let attributeKeys: string[]
    try {
      attributeKeys = await generateAttributeKeys(
        cat.name,
        cat.questions.map((q, qi) => ({
          label: `Question ${qi + 1}`,
          question: q.question,
        })),
      )
    } catch {
      attributeKeys = cat.questions.map((q) =>
        q.question.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 30),
      )
    }

    scoringPrompts.push(buildScoringForCategory(cat, catContent, attributeKeys))
  }

  const generatedResult = { callPrompt, scoringPrompts }
  if (!config.selectedOrganizationId)
    return { ...generatedResult, persisted: null, persistenceError: null }

  onProgress?.("Persisting generated prompts to selected organization...")
  try {
    const persisted = await persistWizardArtifacts(config, generatedResult, onProgress)
    onProgress?.("Generation and persistence complete")
    return { ...generatedResult, persisted, persistenceError: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown persistence error"
    return {
      ...generatedResult,
      persisted: null,
      persistenceError: `Generated successfully, but could not save to organization: ${message}`,
    }
  }
}

export { parseCSV, groupByCategory, runWizard }
export type {
  SpreadsheetRow,
  CategoryGroup,
  WizardConfig,
  WizardResult,
  WizardScoringResult,
}

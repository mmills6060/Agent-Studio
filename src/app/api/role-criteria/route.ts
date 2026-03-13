import OpenAI from "openai"
import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"
import { getEnvironment } from "@/lib/environment"

function parseFirstPositionId(positionIds: unknown): string | null {
  if (typeof positionIds !== "string")
    return null

  const [firstPositionId] = positionIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (!firstPositionId)
    return null

  return firstPositionId
}

function parseDelimitedIds(value: unknown): string[] {
  if (typeof value !== "string")
    return []

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number")
    return String(value)

  return null
}

function parseStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value.trim()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get("roleId")?.trim() ?? ""

  if (!roleId)
    return NextResponse.json(
      { error: "roleId is required" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const roleResult = await executeSqlQuery(
      `
        SELECT PositionIDs
        FROM prodtake2ai.JobRoles
        WHERE RoleID = ?
        LIMIT 1
      `,
      [roleId],
    )

    if (roleResult.rowCount === 0)
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 },
      )

    const firstPositionId = parseFirstPositionId(roleResult.rows[0]?.PositionIDs)
    if (!firstPositionId)
      return NextResponse.json({ rows: [] })

    const jobPositionResult = await executeSqlQuery(
      `
        SELECT AssessmentInstanceID
        FROM prodtake2ai.JobPositions
        WHERE JobPositionID = ?
        LIMIT 1
      `,
      [firstPositionId],
      environment,
    )

    const assessmentInstanceId = toStringValue(jobPositionResult.rows[0]?.AssessmentInstanceID)
    if (!assessmentInstanceId)
      return NextResponse.json({ rows: [] })

    const assessmentInstanceResult = await executeSqlQuery(
      `
        SELECT AssessmentID
        FROM prodtake2ai.AssessmentInstances
        WHERE AssessmentInstanceID = ?
        LIMIT 1
      `,
      [assessmentInstanceId],
      environment,
    )

    const assessmentId = toStringValue(assessmentInstanceResult.rows[0]?.AssessmentID)
    if (!assessmentId)
      return NextResponse.json({ rows: [] })

    const assessmentsResult = await executeSqlQuery(
      `
        SELECT Tasks
        FROM prodtake2ai.Assessments
        WHERE AssessmentID = ?
        LIMIT 1
      `,
      [assessmentId],
      environment,
    )

    const taskIds = parseDelimitedIds(assessmentsResult.rows[0]?.Tasks)
    if (taskIds.length === 0)
      return NextResponse.json({ rows: [] })

    const taskPlaceholders = taskIds.map(() => "?").join(", ")
    const taskResult = await executeSqlQuery(
      `
        SELECT TaskID, PromptID, CriteriaIDs
        FROM prodtake2ai.Tasks
        WHERE TaskID IN (${taskPlaceholders})
        AND PromptID IS NOT NULL
      `,
      taskIds,
      environment,
    )

    const criteriaIds = new Set<string>()
    const criteriaByPrompt = new Map<string, Set<string>>()

    for (const row of taskResult.rows) {
      const promptId = toStringValue(row.PromptID)
      if (!promptId)
        continue

      const currentPromptCriteria = criteriaByPrompt.get(promptId) ?? new Set<string>()
      const parsedCriteriaIds = parseDelimitedIds(row.CriteriaIDs)
      for (const criteriaId of parsedCriteriaIds) {
        criteriaIds.add(criteriaId)
        currentPromptCriteria.add(criteriaId)
      }
      criteriaByPrompt.set(promptId, currentPromptCriteria)
    }

    if (criteriaIds.size === 0)
      return NextResponse.json({ rows: [] })

    const uniqueCriteriaIds = [...criteriaIds]
    const criteriaPlaceholders = uniqueCriteriaIds.map(() => "?").join(", ")
    const criteriaResult = await executeSqlQuery(
      `
        SELECT CriteriaID, CriteriaName
        FROM prodtake2ai.Criteria
        WHERE CriteriaID IN (${criteriaPlaceholders})
      `,
      uniqueCriteriaIds,
      environment,
    )

    const criteriaNameById = new Map<string, string>()
    for (const row of criteriaResult.rows) {
      const criteriaId = toStringValue(row.CriteriaID)
      const criteriaName = row.CriteriaName
      if (!criteriaId || typeof criteriaName !== "string")
        continue
      criteriaNameById.set(criteriaId, criteriaName)
    }

    const rows: Array<{ PromptID: string; CriteriaID: string; CriteriaName: string }> = []
    for (const [promptId, promptCriteriaIds] of criteriaByPrompt) {
      for (const criteriaId of promptCriteriaIds) {
        const criteriaName = criteriaNameById.get(criteriaId)
        if (!criteriaName)
          continue
        rows.push({
          PromptID: promptId,
          CriteriaID: criteriaId,
          CriteriaName: criteriaName,
        })
      }
    }

    rows.sort((a, b) => a.CriteriaName.localeCompare(b.CriteriaName))
    return NextResponse.json({ rows })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Role criteria lookup failed: ${message}` },
      { status: 502 },
    )
  }
}

interface CreateRoleCriteriaRequest {
  roleId?: unknown
  promptId?: unknown
  criteriaName?: unknown
  minScore?: unknown
  maxScore?: unknown
  scoringPrompt?: unknown
}

interface TaskRow {
  TaskID?: unknown
  CriteriaIDs?: unknown
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return value

  if (typeof value !== "string")
    return null

  const trimmedValue = value.trim()
  if (!trimmedValue)
    return null

  const parsedValue = Number(trimmedValue)
  if (!Number.isFinite(parsedValue))
    return null

  return parsedValue
}

const DEFAULT_SCORING_PROMPT_TEMPLATE = `What this indicator assesses
Your task is to evaluate a transcript of a conversation between the AI Interviewer and the candidate for SECTION 2: QUALIFICATIONS (CLOSE-ENDED).

Important input: AI Interviewer Questions
Do you have an active driver's license? What is your highest level of education? If unclear, clarify the credential and whether it is completed. Do you hold an EMT-B, AEMT, or CCMA certification? If yes, clarify which one(s) and whether it is current/active. Are you BLS & CPR Certified? If yes, clarify whether it is current. If no, clarify whether the candidate is willing and able to obtain it. Do you have experience treating patients in their residence?

Scoring Scale with Examples

Driver's License – 10 points
10 = Holds a license
0 = Doesn't hold a license

Comfort driving – 0 points
0 = candidate is comfortable driving to and from the location of the patient
0 = candidate is not comfortable driving to and from the location of the patient

Scoring Instructions (Required Process)
Step 1 — Assign points for each attribute separately. If the candidate does not mention an attribute, assign 0. Do not infer willingness, completion status, or certification validity unless explicitly stated. Step 2 — Write a rationale. The rationale must: Be 40 words or fewer. Summarize education status, EMT/AEMT/CCMA certification status, and BLS/CPR status. Match the numeric scores exactly. Use factual, natural language only. Not include assumptions or evaluative commentary.
"drivers_license_points": <0 or 10>
"comfort_driving": <0 or 0>

Evaluator Guardrails
Do not infer, assume, or use information not explicitly stated in the transcript.

Standardized Output Format
{"rationale": "<text rationale>", "attribute_scores": {"drivers_license_points": <0 or 10>, "comfort_driving": <0 or 0>}}`

function buildFallbackIndicatorDescription(
  criteriaName: string,
  minScore: number,
  maxScore: number,
): string {
  return `Evaluates overall performance for "${criteriaName}" on a ${minScore} to ${maxScore} scale based on evidence shown in the interview conversation.`
}

async function generateIndicatorDescription(
  criteriaName: string,
  minScore: number,
  maxScore: number,
  scoringPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return buildFallbackIndicatorDescription(criteriaName, minScore, maxScore)

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You write concise interview scoring indicator descriptions.",
        },
        {
          role: "user",
          content: `Write one sentence (max 35 words) describing this scoring indicator.

Criteria name: ${criteriaName}
Score range: ${minScore} to ${maxScore}
Scoring prompt context:
${scoringPrompt || "(not provided)"}

Return only the sentence.`,
        },
      ],
    })

    const description = completion.choices[0]?.message?.content?.trim() ?? ""
    if (!description)
      return buildFallbackIndicatorDescription(criteriaName, minScore, maxScore)

    return description
  } catch {
    return buildFallbackIndicatorDescription(criteriaName, minScore, maxScore)
  }
}

async function insertIndicatorNode(
  criteriaName: string,
  indicatorDescription: string,
  minScore: number,
  maxScore: number,
  environment: "dev" | "prod",
): Promise<string> {
  try {
    const indicatorResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Indicators
          (IndicatorName, IndicatorDescription, MinValidScore, MaxValidScore)
        VALUES (?, ?, ?, ?)
      `,
      [criteriaName, indicatorDescription, minScore, maxScore],
      environment,
    )
    const indicatorId = indicatorResult.insertId
    if (indicatorId)
      return String(indicatorId)
  } catch {
    // Try a schema variant without IndicatorDescription when it's not present.
  }

  try {
    const indicatorResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Indicators
          (IndicatorName, MinValidScore, MaxValidScore)
        VALUES (?, ?, ?)
      `,
      [criteriaName, minScore, maxScore],
      environment,
    )
    const indicatorId = indicatorResult.insertId
    if (indicatorId)
      return String(indicatorId)
  } catch {
    // Try schema variants without IndicatorName.
  }

  try {
    const indicatorResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Indicators
          (IndicatorDescription, MinValidScore, MaxValidScore)
        VALUES (?, ?, ?)
      `,
      [indicatorDescription, minScore, maxScore],
      environment,
    )
    const indicatorId = indicatorResult.insertId
    if (indicatorId)
      return String(indicatorId)
  } catch {
    // Final fallback when only min/max are supported.
  }

  const fallbackIndicatorResult = await executeSqlMutation(
    `
      INSERT INTO prodtake2ai.Indicators
        (MinValidScore, MaxValidScore)
      VALUES (?, ?)
    `,
    [minScore, maxScore],
    environment,
  )
  const fallbackIndicatorId = fallbackIndicatorResult.insertId
  if (!fallbackIndicatorId)
    throw new SqlQueryValidationError("Failed to create indicator", 502)

  return String(fallbackIndicatorId)
}

async function linkTaskCriteriaIndicator(
  taskId: string,
  criteriaId: string,
  indicatorId: string,
  scoringPrompt: string,
  environment: "dev" | "prod",
) {
  const promptToUse = scoringPrompt.trim() || DEFAULT_SCORING_PROMPT_TEMPLATE

  try {
    await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.TaskCriteriaIndicatorPrompts
          (TaskID, CriteriaID, IndicatorID, ScoringPrompt, shouldShowRationale)
        VALUES (?, ?, ?, ?, 1)
      `,
      [taskId, criteriaId, indicatorId, promptToUse],
      environment,
    )
    return
  } catch {
    // Fallback when ScoringPrompt is absent/defaulted in this environment.
  }

  await executeSqlMutation(
    `
      INSERT INTO prodtake2ai.TaskCriteriaIndicatorPrompts
        (TaskID, CriteriaID, IndicatorID, shouldShowRationale)
      VALUES (?, ?, ?, 1)
    `,
    [taskId, criteriaId, indicatorId],
    environment,
  )
}

export async function POST(request: Request) {
  let body: CreateRoleCriteriaRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const roleId = parseStringValue(body.roleId)
  const promptId = parseStringValue(body.promptId)
  const criteriaName = parseStringValue(body.criteriaName)
  const minScore = parseNumberValue(body.minScore)
  const maxScore = parseNumberValue(body.maxScore)
  const scoringPrompt = parseStringValue(body.scoringPrompt)

  if (!roleId)
    return NextResponse.json(
      { error: "roleId is required" },
      { status: 400 },
    )

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  if (!criteriaName)
    return NextResponse.json(
      { error: "criteriaName is required" },
      { status: 400 },
    )

  if (minScore === null)
    return NextResponse.json(
      { error: "minScore is required and must be a number" },
      { status: 400 },
    )

  if (maxScore === null)
    return NextResponse.json(
      { error: "maxScore is required and must be a number" },
      { status: 400 },
    )

  if (minScore > maxScore)
    return NextResponse.json(
      { error: "minScore must be less than or equal to maxScore" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const roleResult = await executeSqlQuery(
      `
        SELECT PositionIDs
        FROM prodtake2ai.JobRoles
        WHERE RoleID = ?
        LIMIT 1
      `,
      [roleId],
      environment,
    )

    if (roleResult.rowCount === 0)
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 },
      )

    const firstPositionId = parseFirstPositionId(roleResult.rows[0]?.PositionIDs)
    if (!firstPositionId)
      return NextResponse.json(
        { error: "No position found for role" },
        { status: 404 },
      )

    const jobPositionResult = await executeSqlQuery(
      `
        SELECT AssessmentInstanceID
        FROM prodtake2ai.JobPositions
        WHERE JobPositionID = ?
        LIMIT 1
      `,
      [firstPositionId],
      environment,
    )

    const assessmentInstanceId = toStringValue(jobPositionResult.rows[0]?.AssessmentInstanceID)
    if (!assessmentInstanceId)
      return NextResponse.json(
        { error: "No assessment instance found for role" },
        { status: 404 },
      )

    const assessmentInstanceResult = await executeSqlQuery(
      `
        SELECT AssessmentID
        FROM prodtake2ai.AssessmentInstances
        WHERE AssessmentInstanceID = ?
        LIMIT 1
      `,
      [assessmentInstanceId],
      environment,
    )

    const assessmentId = toStringValue(assessmentInstanceResult.rows[0]?.AssessmentID)
    if (!assessmentId)
      return NextResponse.json(
        { error: "No assessment found for role" },
        { status: 404 },
      )

    const assessmentsResult = await executeSqlQuery(
      `
        SELECT Tasks
        FROM prodtake2ai.Assessments
        WHERE AssessmentID = ?
        LIMIT 1
      `,
      [assessmentId],
      environment,
    )

    const taskIds = parseDelimitedIds(assessmentsResult.rows[0]?.Tasks)
    if (taskIds.length === 0)
      return NextResponse.json(
        { error: "No tasks found for role" },
        { status: 404 },
      )

    const taskPlaceholders = taskIds.map(() => "?").join(", ")
    const taskResult = await executeSqlQuery(
      `
        SELECT TaskID, CriteriaIDs
        FROM prodtake2ai.Tasks
        WHERE TaskID IN (${taskPlaceholders})
        AND PromptID = ?
      `,
      [...taskIds, promptId],
      environment,
    )

    if (taskResult.rowCount === 0)
      return NextResponse.json(
        { error: "No task found for prompt" },
        { status: 404 },
      )

    let criteriaResult
    try {
      criteriaResult = await executeSqlMutation(
        `
          INSERT INTO prodtake2ai.Criteria (CriteriaName, CriteriaDescription)
          VALUES (?, ?)
        `,
        [criteriaName, criteriaName],
        environment,
      )
    } catch {
      criteriaResult = await executeSqlMutation(
        `
          INSERT INTO prodtake2ai.Criteria (CriteriaName)
          VALUES (?)
        `,
        [criteriaName],
        environment,
      )
    }

    const criteriaId = criteriaResult.insertId
    if (!criteriaId)
      throw new SqlQueryValidationError("Failed to create criteria", 502)

    const createdCriteriaId = String(criteriaId)
    const indicatorDescription = await generateIndicatorDescription(
      criteriaName,
      minScore,
      maxScore,
      scoringPrompt,
    )
    const indicatorId = await insertIndicatorNode(
      criteriaName,
      indicatorDescription,
      minScore,
      maxScore,
      environment,
    )

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.Criteria
        SET IndicatorIDs = ?
        WHERE CriteriaID = ?
      `,
      [indicatorId, createdCriteriaId],
      environment,
    )

    for (const row of taskResult.rows as TaskRow[]) {
      const taskId = toStringValue(row.TaskID)
      if (!taskId)
        continue

      const existingCriteriaIds = parseDelimitedIds(row.CriteriaIDs)
      const mergedCriteriaIds = new Set(existingCriteriaIds)
      mergedCriteriaIds.add(String(criteriaId))

      await executeSqlMutation(
        `
          UPDATE prodtake2ai.Tasks
          SET CriteriaIDs = ?
          WHERE TaskID = ?
        `,
        [[...mergedCriteriaIds].join(","), taskId],
        environment,
      )

      await linkTaskCriteriaIndicator(taskId, createdCriteriaId, indicatorId, scoringPrompt, environment)
    }

    return NextResponse.json({
      criteriaId: createdCriteriaId,
      criteriaName,
      promptId,
      indicatorId,
      indicatorDescription,
      minScore,
      maxScore,
    })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Role criteria creation failed: ${message}` },
      { status: 502 },
    )
  }
}

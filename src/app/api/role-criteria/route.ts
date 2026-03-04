import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"

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

async function insertIndicatorNode(
  criteriaName: string,
  minScore: number,
  maxScore: number,
) : Promise<string> {
  try {
    const indicatorResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Indicators
          (IndicatorName, MinValidScore, MaxValidScore)
        VALUES (?, ?, ?)
      `,
      [criteriaName, minScore, maxScore],
    )
    const indicatorId = indicatorResult.insertId
    if (indicatorId)
      return String(indicatorId)
  } catch {
    // Try a schema variant without IndicatorName when it's not present.
  }

  const fallbackIndicatorResult = await executeSqlMutation(
    `
      INSERT INTO prodtake2ai.Indicators
        (MinValidScore, MaxValidScore)
      VALUES (?, ?)
    `,
    [minScore, maxScore],
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
) {
  try {
    await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.TaskCriteriaIndicatorPrompts
          (TaskID, CriteriaID, IndicatorID, ScoringPrompt)
        VALUES (?, ?, ?, ?)
      `,
      [taskId, criteriaId, indicatorId, ""],
    )
    return
  } catch {
    // Fallback when ScoringPrompt is absent/defaulted in this environment.
  }

  await executeSqlMutation(
    `
      INSERT INTO prodtake2ai.TaskCriteriaIndicatorPrompts
        (TaskID, CriteriaID, IndicatorID)
      VALUES (?, ?, ?)
    `,
    [taskId, criteriaId, indicatorId],
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
    )

    if (taskResult.rowCount === 0)
      return NextResponse.json(
        { error: "No task found for prompt" },
        { status: 404 },
      )

    const criteriaResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Criteria (CriteriaName)
        VALUES (?)
      `,
      [criteriaName],
    )

    const criteriaId = criteriaResult.insertId
    if (!criteriaId)
      throw new SqlQueryValidationError("Failed to create criteria", 502)

    const createdCriteriaId = String(criteriaId)
    const indicatorId = await insertIndicatorNode(
      criteriaName,
      minScore,
      maxScore,
    )

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.Criteria
        SET IndicatorIDs = ?
        WHERE CriteriaID = ?
      `,
      [indicatorId, createdCriteriaId],
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
      )

      await linkTaskCriteriaIndicator(taskId, createdCriteriaId, indicatorId)
    }

    return NextResponse.json({
      criteriaId: createdCriteriaId,
      criteriaName,
      promptId,
      indicatorId,
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

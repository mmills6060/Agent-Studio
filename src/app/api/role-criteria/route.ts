import { NextResponse } from "next/server"

import { executeSqlQuery, SqlQueryValidationError } from "@/lib/database"

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

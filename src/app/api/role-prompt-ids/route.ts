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
    const promptsResult = await executeSqlQuery(
      `
        SELECT DISTINCT PromptID
        FROM prodtake2ai.Tasks
        WHERE TaskID IN (${taskPlaceholders})
        AND PromptID IS NOT NULL
      `,
      taskIds,
    )

    return NextResponse.json({
      rows: promptsResult.rows,
      rowCount: promptsResult.rowCount,
      command: promptsResult.command,
    })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Role prompt lookup failed: ${message}` },
      { status: 502 },
    )
  }
}

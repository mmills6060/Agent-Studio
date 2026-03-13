import { NextResponse } from "next/server"

import { executeSqlMutation, executeSqlQuery, SqlQueryValidationError } from "@/lib/database"
import { getEnvironment } from "@/lib/environment"

interface UpdateScoreConfigRequest {
  indicatorId?: unknown
  minScore?: unknown
  maxScore?: unknown
}

function parseStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value.trim()
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

function toStringValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value)

  return ""
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return value

  if (typeof value === "string") {
    const parsedValue = Number(value)
    if (Number.isFinite(parsedValue))
      return parsedValue
  }

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const criteriaId = searchParams.get("criteriaId")?.trim() ?? ""

  if (!criteriaId)
    return NextResponse.json(
      { error: "criteriaId is required" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const result = await executeSqlQuery(
      `
        SELECT DISTINCT
          i.IndicatorID,
          i.IndicatorName,
          i.MinValidScore,
          i.MaxValidScore
        FROM prodtake2ai.TaskCriteriaIndicatorPrompts tcip
        INNER JOIN prodtake2ai.Indicators i ON i.IndicatorID = tcip.IndicatorID
        WHERE tcip.CriteriaID = ?
        ORDER BY i.IndicatorID ASC
      `,
      [criteriaId],
      environment,
    )

    const rows = result.rows
      .map((row) => {
        const indicatorId = toStringValue(row.IndicatorID)
        const minScore = toNumberValue(row.MinValidScore)
        const maxScore = toNumberValue(row.MaxValidScore)
        if (!indicatorId || minScore === null || maxScore === null)
          return null

        return {
          indicatorId,
          indicatorName: toStringValue(row.IndicatorName),
          minScore,
          maxScore,
        }
      })
      .filter((row): row is { indicatorId: string; indicatorName: string; minScore: number; maxScore: number } => row !== null)

    return NextResponse.json({ rows })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Criteria score config lookup failed: ${message}` },
      { status: 502 },
    )
  }
}

export async function PATCH(request: Request) {
  let body: UpdateScoreConfigRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const indicatorId = parseStringValue(body.indicatorId)
  const minScore = parseNumberValue(body.minScore)
  const maxScore = parseNumberValue(body.maxScore)

  if (!indicatorId)
    return NextResponse.json(
      { error: "indicatorId is required" },
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
    const result = await executeSqlMutation(
      `
        UPDATE prodtake2ai.Indicators
        SET MinValidScore = ?, MaxValidScore = ?
        WHERE IndicatorID = ?
      `,
      [minScore, maxScore, indicatorId],
      environment,
    )

    if (result.affectedRows === 0)
      return NextResponse.json(
        { error: "Indicator not found" },
        { status: 404 },
      )

    return NextResponse.json({ indicatorId, minScore, maxScore })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Criteria score config update failed: ${message}` },
      { status: 502 },
    )
  }
}

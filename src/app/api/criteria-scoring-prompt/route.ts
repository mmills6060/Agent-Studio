import { NextResponse } from "next/server"

import { executeSqlQuery, SqlQueryValidationError } from "@/lib/database"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const criteriaId = searchParams.get("criteriaId")?.trim() ?? ""

  if (!criteriaId)
    return NextResponse.json(
      { error: "criteriaId is required" },
      { status: 400 },
    )

  try {
    const result = await executeSqlQuery(
      `
        SELECT ScoringPrompt
        FROM prodtake2ai.TaskCriteriaIndicatorPrompts
        WHERE CriteriaID = ?
        AND ScoringPrompt IS NOT NULL
        AND TRIM(ScoringPrompt) <> ''
        ORDER BY TaskID ASC, IndicatorID ASC
        LIMIT 1
      `,
      [criteriaId],
    )

    if (result.rowCount === 0)
      return NextResponse.json(
        { error: "Scoring prompt not found for criteria" },
        { status: 404 },
      )

    const scoringPrompt = result.rows[0]?.ScoringPrompt
    if (typeof scoringPrompt !== "string")
      return NextResponse.json(
        { error: "Scoring prompt not found for criteria" },
        { status: 404 },
      )

    return NextResponse.json({ scoringPrompt })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Criteria scoring prompt lookup failed: ${message}` },
      { status: 502 },
    )
  }
}

import { NextResponse } from "next/server"

import { executeSqlQuery, SqlQueryValidationError } from "@/lib/database"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const promptId = searchParams.get("promptId")?.trim() ?? ""

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  try {
    const result = await executeSqlQuery(
      `
        SELECT PromptString
        FROM prodtake2ai.Prompts
        WHERE PromptID = ?
        LIMIT 1
      `,
      [promptId],
    )

    if (result.rowCount === 0)
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 },
      )

    const promptString = result.rows[0]?.PromptString
    if (typeof promptString !== "string")
      return NextResponse.json(
        { error: "Prompt string not found" },
        { status: 404 },
      )

    return NextResponse.json({ promptString })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Prompt lookup failed: ${message}` },
      { status: 502 },
    )
  }
}

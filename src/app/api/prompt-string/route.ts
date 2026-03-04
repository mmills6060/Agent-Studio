import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"

interface UpdatePromptStringRequest {
  promptId?: unknown
  promptString?: unknown
}

function parseStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value.trim()
}

function parseRawStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value
}

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

export async function PATCH(request: Request) {
  let body: UpdatePromptStringRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const promptId = parseStringValue(body.promptId)
  const promptString = parseRawStringValue(body.promptString)

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  try {
    const result = await executeSqlMutation(
      `
        UPDATE prodtake2ai.Prompts
        SET PromptString = ?
        WHERE PromptID = ?
        LIMIT 1
      `,
      [promptString, promptId],
    )

    if (result.affectedRows === 0)
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 },
      )

    return NextResponse.json({ promptId })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Prompt update failed: ${message}` },
      { status: 502 },
    )
  }
}

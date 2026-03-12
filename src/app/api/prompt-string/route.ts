import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"
import { getEnvironment } from "@/lib/environment"

interface UpdatePromptStringRequest {
  promptId?: unknown
  promptString?: unknown
  agentMetadata?: unknown
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

function parseNullableAgentMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined)
    return null

  if (typeof value === "string")
    return value

  if (Buffer.isBuffer(value))
    return value.toString("utf8")

  if (typeof value === "object")
    return JSON.stringify(value)

  if (typeof value === "number" || typeof value === "boolean")
    return String(value)

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const promptId = searchParams.get("promptId")?.trim() ?? ""

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const result = await executeSqlQuery(
      `
        SELECT PromptString, AgentMetadata
        FROM prodtake2ai.Prompts
        WHERE PromptID = ?
        LIMIT 1
      `,
      [promptId],
      environment,
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

    const agentMetadata = parseNullableAgentMetadataValue(result.rows[0]?.AgentMetadata)

    return NextResponse.json({
      promptString,
      agentMetadata,
    })
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
  const hasPromptString = typeof body.promptString === "string"
  const hasAgentMetadata = typeof body.agentMetadata === "string" || body.agentMetadata === null
  const promptString = hasPromptString ? parseRawStringValue(body.promptString) : ""
  const agentMetadata = typeof body.agentMetadata === "string" ? parseRawStringValue(body.agentMetadata) : null

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  if (!hasPromptString && !hasAgentMetadata)
    return NextResponse.json(
      { error: "At least one field to update is required" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const updateClauses: string[] = []
    const updateValues: unknown[] = []

    if (hasPromptString) {
      updateClauses.push("PromptString = ?")
      updateValues.push(promptString)
    }

    if (hasAgentMetadata) {
      updateClauses.push("AgentMetadata = ?")
      updateValues.push(agentMetadata)
    }

    const result = await executeSqlMutation(
      `
        UPDATE prodtake2ai.Prompts
        SET ${updateClauses.join(", ")}
        WHERE PromptID = ?
        LIMIT 1
      `,
      [...updateValues, promptId],
      environment,
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

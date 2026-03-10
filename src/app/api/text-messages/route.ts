import { NextResponse } from "next/server"
import { executeSqlMutation, SqlQueryValidationError } from "@/lib/database"
import { getEnvironment } from "@/lib/environment"

interface CreateTextMessagesRequest {
  orgId?: unknown
  roleId?: unknown
  positionId?: unknown
  messages?: unknown
}

interface TextMessageInput {
  messageType: string
  messageContent: string
  associatedRoleId?: string | null
}

function parseStringValue(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

export async function POST(request: Request) {
  let body: CreateTextMessagesRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const orgId = parseStringValue(body.orgId)
  const roleId = parseStringValue(body.roleId)
  const positionId = parseStringValue(body.positionId)

  if (!orgId)
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })

  if (!roleId)
    return NextResponse.json({ error: "roleId is required" }, { status: 400 })

  if (!Array.isArray(body.messages) || body.messages.length === 0)
    return NextResponse.json({ error: "messages array is required" }, { status: 400 })

  const messages = body.messages as TextMessageInput[]
  const environment = await getEnvironment()

  try {
    const insertedIds: number[] = []

    for (const msg of messages) {
      const result = await executeSqlMutation(
        `
          INSERT INTO prodtake2ai.TextMessage
            (OrgID, RoleID, PositionID, MessageType, MessageContent, AssociatedRoleID)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          orgId,
          roleId,
          positionId || null,
          msg.messageType,
          msg.messageContent,
          msg.associatedRoleId ?? null,
        ],
        environment,
      )

      if (!result.insertId)
        throw new SqlQueryValidationError(`Failed to create text message: ${msg.messageType}`, 502)

      insertedIds.push(result.insertId)
    }

    return NextResponse.json({ textMessageIds: insertedIds })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Text message creation failed: ${message}` }, { status: 502 })
  }
}

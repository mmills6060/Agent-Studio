import { NextResponse } from "next/server"

import {
  executeSqlQuery,
  SqlQueryValidationError,
  testDatabaseConnection,
} from "@/lib/database"
import { getEnvironment } from "@/lib/environment"

interface SqlQueryRequest {
  query: string
  params?: unknown[]
}

export async function GET() {
  const environment = await getEnvironment()
  try {
    const result = await testDatabaseConnection(environment)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Database connection failed: ${message}` },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  let body: SqlQueryRequest

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const query = typeof body.query === "string" ? body.query : ""
  const params = body.params ?? []

  if (!query.trim())
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 },
    )

  if (!Array.isArray(params))
    return NextResponse.json(
      { error: "params must be an array" },
      { status: 400 },
    )

  const environment = await getEnvironment()
  try {
    const result = await executeSqlQuery(query, params, environment)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Database query failed: ${message}` },
      { status: 502 },
    )
  }
}

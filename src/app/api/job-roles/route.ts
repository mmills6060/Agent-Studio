import { NextResponse } from "next/server"

import { executeSqlQuery, SqlQueryValidationError } from "@/lib/database"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get("orgId")?.trim() ?? ""

  if (!orgId)
    return NextResponse.json(
      { error: "orgId is required" },
      { status: 400 },
    )

  try {
    const result = await executeSqlQuery(
      `
        SELECT RoleID, RoleLink, RoleDescription, PositionIDs, OrgID, Status, RoleFile, RoleImage, RoleCode, isDemo, IsHidden
        FROM prodtake2ai.JobRoles
        WHERE OrgID = ?
        ORDER BY RoleDescription ASC
      `,
      [orgId],
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Job roles query failed: ${message}` },
      { status: 502 },
    )
  }
}

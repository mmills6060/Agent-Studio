import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"

interface CreateJobRoleRequest {
  orgId?: unknown
  roleDescription?: unknown
  assessmentInstanceName?: unknown
}

interface CreateJobRoleResponse {
  roleId: string
  assessmentId: string
  assessmentInstanceId: string
  jobPositionId: string
  roleDescription: string
  assessmentInstanceName: string
  assessmentInstanceType: "JOB"
}

function parseStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value.trim()
}

function parseDelimitedIds(value: unknown): string[] {
  if (typeof value !== "string")
    return []

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

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

export async function POST(request: Request) {
  let body: CreateJobRoleRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const orgId = parseStringValue(body.orgId)
  const roleDescription = parseStringValue(body.roleDescription)
  const assessmentInstanceName = parseStringValue(body.assessmentInstanceName)

  if (!orgId)
    return NextResponse.json(
      { error: "orgId is required" },
      { status: 400 },
    )

  if (!roleDescription)
    return NextResponse.json(
      { error: "roleDescription is required" },
      { status: 400 },
    )

  if (!assessmentInstanceName)
    return NextResponse.json(
      { error: "assessmentInstanceName is required" },
      { status: 400 },
    )

  try {
    const assessmentResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Assessments (Tasks)
        VALUES (?)
      `,
      [""],
    )

    const assessmentId = assessmentResult.insertId
    if (!assessmentId)
      throw new SqlQueryValidationError("Failed to create assessment", 502)

    const assessmentInstanceResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.AssessmentInstances (AssessmentID, AssessmentInstanceName, AssessmentInstanceType)
        VALUES (?, ?, ?)
      `,
      [assessmentId, assessmentInstanceName, "JOB"],
    )

    const assessmentInstanceId = assessmentInstanceResult.insertId
    if (!assessmentInstanceId)
      throw new SqlQueryValidationError("Failed to create assessment instance", 502)

    const industriesResult = await executeSqlQuery(
      `
        SELECT AssessmentInstanceIDs
        FROM prodtake2ai.Industries
        WHERE IndustryID = ?
        LIMIT 1
      `,
      [orgId],
    )

    const nextAssessmentInstanceIdValue = String(assessmentInstanceId)
    if (industriesResult.rowCount === 0) {
      await executeSqlMutation(
        `
          INSERT INTO prodtake2ai.Industries (IndustryID, AssessmentInstanceIDs)
          VALUES (?, ?)
        `,
        [orgId, nextAssessmentInstanceIdValue],
      )
    } else {
      const existingAssessmentInstanceIds = parseDelimitedIds(
        industriesResult.rows[0]?.AssessmentInstanceIDs,
      )
      const dedupedAssessmentInstanceIds = new Set(existingAssessmentInstanceIds)
      dedupedAssessmentInstanceIds.add(nextAssessmentInstanceIdValue)
      const updatedAssessmentInstanceIds = [...dedupedAssessmentInstanceIds].join(",")

      await executeSqlMutation(
        `
          UPDATE prodtake2ai.Industries
          SET AssessmentInstanceIDs = ?
          WHERE IndustryID = ?
        `,
        [updatedAssessmentInstanceIds, orgId],
      )
    }

    const roleResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.JobRoles
          (RoleLink, RoleDescription, PositionIDs, OrgID, Status, RoleFile, RoleImage, RoleCode, isDemo, IsHidden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ["", roleDescription, "", orgId, "Active", "", "", "", 0, 0],
    )

    const roleId = roleResult.insertId
    if (!roleId)
      throw new SqlQueryValidationError("Failed to create role", 502)

    const jobPositionResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.JobPositions
          (Title, Description, Location, Status, EmployerIDs, AssessmentInstanceID, PositionLink, PositionFile, RoleID, IsCampaign, IsReferenceCheck)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [roleDescription, "", "", "Active", "", assessmentInstanceId, "", "", roleId, 0, 0],
    )

    const jobPositionId = jobPositionResult.insertId
    if (!jobPositionId)
      throw new SqlQueryValidationError("Failed to create job position", 502)

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.JobRoles
        SET PositionIDs = ?
        WHERE RoleID = ?
      `,
      [String(jobPositionId), roleId],
    )

    const responseBody: CreateJobRoleResponse = {
      roleId: String(roleId),
      assessmentId: String(assessmentId),
      assessmentInstanceId: String(assessmentInstanceId),
      jobPositionId: String(jobPositionId),
      roleDescription,
      assessmentInstanceName,
      assessmentInstanceType: "JOB",
    }
    return NextResponse.json(responseBody)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Job role creation failed: ${message}` },
      { status: 502 },
    )
  }
}

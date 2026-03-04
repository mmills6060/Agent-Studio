import type { AppSidebarJobRole } from "@/components/handlers/app-sidebar-handlers"

interface JobRolesResponse {
  rows?: Record<string, unknown>[]
  error?: string
}

interface CreateJobRoleInput {
  orgId: string
  roleDescription: string
  assessmentInstanceName: string
}

interface CreateJobRoleResponse {
  roleId?: string
  assessmentId?: string
  assessmentInstanceId?: string
  jobPositionId?: string
  promptId?: string
  roleDescription?: string
  assessmentInstanceName?: string
  assessmentInstanceType?: "JOB"
  error?: string
}

interface CreatedJobRole {
  roleId: string
  assessmentId: string | null
  assessmentInstanceId: string | null
  jobPositionId: string | null
  promptId: string | null
  roleDescription: string | null
  assessmentInstanceName: string | null
  assessmentInstanceType: "JOB" | null
}

function parseJobRole(row: Record<string, unknown>): AppSidebarJobRole | null {
  const roleId = row.RoleID
  const roleDescription = row.RoleDescription
  if ((typeof roleId !== "number" && typeof roleId !== "string") || typeof roleDescription !== "string")
    return null

  return {
    roleId: String(roleId),
    roleDescription,
  }
}

export async function getJobRolesByOrganization(orgId: string): Promise<AppSidebarJobRole[]> {
  const response = await fetch(`/api/job-roles?orgId=${encodeURIComponent(orgId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: JobRolesResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch job roles")

  const rows = Array.isArray(body?.rows) ? body.rows : []
  return rows
    .map((row) => parseJobRole(row))
    .filter((role): role is AppSidebarJobRole => role !== null)
}

export async function createJobRole(input: CreateJobRoleInput & { promptString?: string }): Promise<CreatedJobRole> {
  const response = await fetch("/api/job-roles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  let body: CreateJobRoleResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to create job role")

  if (typeof body?.roleId !== "string")
    throw new Error("Created role ID is missing from response")

  return {
    roleId: body.roleId,
    assessmentId: typeof body.assessmentId === "string" ? body.assessmentId : null,
    assessmentInstanceId: typeof body.assessmentInstanceId === "string" ? body.assessmentInstanceId : null,
    jobPositionId: typeof body.jobPositionId === "string" ? body.jobPositionId : null,
    promptId: typeof body.promptId === "string" ? body.promptId : null,
    roleDescription: typeof body.roleDescription === "string" ? body.roleDescription : null,
    assessmentInstanceName: typeof body.assessmentInstanceName === "string" ? body.assessmentInstanceName : null,
    assessmentInstanceType: body.assessmentInstanceType === "JOB" ? "JOB" : null,
  }
}

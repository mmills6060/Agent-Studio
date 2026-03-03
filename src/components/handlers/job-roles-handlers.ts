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
  error?: string
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

export async function createJobRole(input: CreateJobRoleInput): Promise<string | null> {
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
    return null

  return body.roleId
}

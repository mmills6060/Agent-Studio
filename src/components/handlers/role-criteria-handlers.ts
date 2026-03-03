import type { AppSidebarCriteria } from "@/components/handlers/app-sidebar-handlers"

interface RoleCriteriaResponse {
  rows?: Record<string, unknown>[]
  error?: string
}

function parseCriteriaRow(row: Record<string, unknown>) {
  const promptId = row.PromptID
  const criteriaId = row.CriteriaID
  const criteriaName = row.CriteriaName

  if (
    (typeof promptId !== "number" && typeof promptId !== "string") ||
    (typeof criteriaId !== "number" && typeof criteriaId !== "string") ||
    typeof criteriaName !== "string"
  )
    return null

  return {
    promptId: String(promptId),
    criteria: {
      criteriaId: String(criteriaId),
      criteriaName,
    } as AppSidebarCriteria,
  }
}

export async function getCriteriaByRole(roleId: string): Promise<Record<string, AppSidebarCriteria[]>> {
  const response = await fetch(`/api/role-criteria?roleId=${encodeURIComponent(roleId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: RoleCriteriaResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch role criteria")

  const rows = Array.isArray(body?.rows) ? body.rows : []
  const parsedRows = rows
    .map((row) => parseCriteriaRow(row))
    .filter((parsed): parsed is { promptId: string; criteria: AppSidebarCriteria } => parsed !== null)

  return parsedRows.reduce<Record<string, AppSidebarCriteria[]>>((acc, row) => {
    const existing = acc[row.promptId] ?? []
    const hasCriteria = existing.some((criteria) => criteria.criteriaId === row.criteria.criteriaId)
    if (!hasCriteria)
      acc[row.promptId] = [...existing, row.criteria]
    return acc
  }, {})
}

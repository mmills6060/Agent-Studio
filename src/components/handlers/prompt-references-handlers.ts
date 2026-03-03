import type { AppSidebarPromptReference } from "@/components/handlers/app-sidebar-handlers"

interface PromptReferencesResponse {
  rows?: Record<string, unknown>[]
  error?: string
}

function parsePromptReference(row: Record<string, unknown>): AppSidebarPromptReference | null {
  const promptId = row.PromptID
  if (typeof promptId !== "number" && typeof promptId !== "string")
    return null

  return { promptId: String(promptId) }
}

export async function getPromptReferencesByRole(roleId: string): Promise<AppSidebarPromptReference[]> {
  const response = await fetch(`/api/role-prompt-ids?roleId=${encodeURIComponent(roleId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: PromptReferencesResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch prompt IDs")

  const rows = Array.isArray(body?.rows) ? body.rows : []
  return rows
    .map((row) => parsePromptReference(row))
    .filter((reference): reference is AppSidebarPromptReference => reference !== null)
}

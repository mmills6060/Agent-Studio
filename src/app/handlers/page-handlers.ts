import type { AppSidebarOrganization } from "@/components/handlers/app-sidebar-handlers"
import { executeSqlQuery } from "@/lib/database"
import type { DbEnvironment } from "@/lib/environment"

function parseOrganizationRow(row: Record<string, unknown>): AppSidebarOrganization | null {
  const orgId = row.OrgID
  const orgName = row.OrgName
  if ((typeof orgId !== "number" && typeof orgId !== "string") || typeof orgName !== "string")
    return null

  return {
    orgId: String(orgId),
    orgName,
  }
}

export async function getOrganizations(environment?: DbEnvironment): Promise<AppSidebarOrganization[]> {
  const env = environment ?? "prod"
  try {
    const result = await executeSqlQuery(
      `
      SELECT OrgID, OrgName
      FROM prodtake2ai.Org
      ORDER BY OrgName ASC
    `,
      [],
      env,
    )

    return result.rows
      .map((row) => parseOrganizationRow(row))
      .filter((organization): organization is AppSidebarOrganization => organization !== null)
  } catch (error) {
    console.error("Failed to load organizations", error)
    return []
  }
}

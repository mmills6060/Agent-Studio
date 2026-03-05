import { getCriteriaScoringPromptById } from "@/components/handlers/criteria-scoring-prompt-handlers"
import { createScoringPromptTab, type ScoringPromptTab } from "@/components/handlers/scoring-prompt-manager-handlers"
import { parseScoringPrompt } from "@/components/handlers/scoring-prompt-parser"
import type { AppSidebarCriteria } from "@/components/handlers/app-sidebar-handlers"

interface LoadAllResult {
  tabs: ScoringPromptTab[]
  errors: { criteriaName: string; error: string }[]
}

export async function loadAllRoleScoringPrompts(
  criteriaByPromptId: Record<string, AppSidebarCriteria[]>,
): Promise<LoadAllResult> {
  const allCriteria = Object.values(criteriaByPromptId).flat()

  if (allCriteria.length === 0)
    return { tabs: [], errors: [] }

  const results = await Promise.allSettled(
    allCriteria.map(async (criteria) => {
      const scoringPromptText = await getCriteriaScoringPromptById(criteria.criteriaId)
      const { nodes, edges } = parseScoringPrompt(scoringPromptText)
      const tab = createScoringPromptTab(criteria.criteriaName)
      tab.nodes = nodes
      tab.edges = edges
      return tab
    }),
  )

  const tabs: ScoringPromptTab[] = []
  const errors: { criteriaName: string; error: string }[] = []

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      tabs.push(result.value)
    } else {
      const criteria = allCriteria[index]
      errors.push({
        criteriaName: criteria.criteriaName,
        error: result.reason instanceof Error ? result.reason.message : "Failed to load",
      })
    }
  })

  return { tabs, errors }
}

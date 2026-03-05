interface CriteriaScoringPromptResponse {
  scoringPrompt?: string
  error?: string
}

interface UpdateScoringPromptResponse {
  criteriaId?: string
  error?: string
}

export async function getCriteriaScoringPromptById(criteriaId: string): Promise<string> {
  const response = await fetch(`/api/criteria-scoring-prompt?criteriaId=${encodeURIComponent(criteriaId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: CriteriaScoringPromptResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch scoring prompt")

  if (typeof body?.scoringPrompt !== "string")
    throw new Error("Scoring prompt not found")

  return body.scoringPrompt
}

export async function updateCriteriaScoringPrompt(criteriaId: string, scoringPrompt: string): Promise<void> {
  const response = await fetch("/api/criteria-scoring-prompt", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteriaId, scoringPrompt }),
  })

  let body: UpdateScoringPromptResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to update scoring prompt")
}

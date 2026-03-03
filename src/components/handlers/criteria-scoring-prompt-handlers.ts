interface CriteriaScoringPromptResponse {
  scoringPrompt?: string
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

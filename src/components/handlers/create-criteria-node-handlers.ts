interface CreateCriteriaNodeInput {
  roleId: string
  promptId: string
  criteriaName: string
  minScore: number
  maxScore: number
}

interface CreateCriteriaNodeResponse {
  criteriaId?: string
  error?: string
}

export async function createCriteriaNode(input: CreateCriteriaNodeInput): Promise<string> {
  const response = await fetch("/api/role-criteria", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  let body: CreateCriteriaNodeResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to create criteria node")

  if (typeof body?.criteriaId !== "string")
    throw new Error("Created criteria ID is missing from response")

  return body.criteriaId
}

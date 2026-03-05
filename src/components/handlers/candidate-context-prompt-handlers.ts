interface CreateContextPromptInput {
  taskId: string
  prompt?: string
}

interface CreateContextPromptResponse {
  promptId?: string
  taskId?: string
  prompt?: string
  createdAt?: string
  updatedAt?: string
  error?: string
}

interface CreatedContextPrompt {
  promptId: string
  taskId: string
  prompt: string
  createdAt: string
  updatedAt: string
}

interface GetContextPromptResponse {
  rows?: { PromptId: number; TaskId: number; Prompt: string; CreatedAt: string; UpdatedAt: string }[]
  rowCount?: number
  error?: string
}

export async function getCandidateContextPrompt(promptId: string): Promise<string | null> {
  const response = await fetch(
    `/api/candidate-context-prompt?promptId=${encodeURIComponent(promptId)}`,
    { method: "GET", cache: "no-store" },
  )

  let body: GetContextPromptResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch context prompt")

  const rows = Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return null

  return typeof rows[0].Prompt === "string" ? rows[0].Prompt : null
}

export async function createCandidateContextPrompt(input: CreateContextPromptInput): Promise<CreatedContextPrompt> {
  const response = await fetch("/api/candidate-context-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  let body: CreateContextPromptResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to create context prompt")

  if (typeof body?.promptId !== "string")
    throw new Error("Created context prompt ID is missing from response")

  return {
    promptId: body.promptId,
    taskId: body.taskId ?? input.taskId,
    prompt: body.prompt ?? "",
    createdAt: body.createdAt ?? "",
    updatedAt: body.updatedAt ?? "",
  }
}

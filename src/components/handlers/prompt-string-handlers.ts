interface PromptStringResponse {
  promptString?: string
  error?: string
}

export async function getPromptStringById(promptId: string): Promise<string> {
  const response = await fetch(`/api/prompt-string?promptId=${encodeURIComponent(promptId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: PromptStringResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch prompt string")

  if (typeof body?.promptString !== "string")
    throw new Error("Prompt string not found")

  return body.promptString
}

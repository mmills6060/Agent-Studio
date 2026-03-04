interface UpdatePromptStringResponse {
  promptId?: string
  error?: string
}

export async function updatePromptStringById(promptId: string, promptString: string): Promise<void> {
  const response = await fetch("/api/prompt-string", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptId,
      promptString,
    }),
  })

  let body: UpdatePromptStringResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to update prompt string")
}

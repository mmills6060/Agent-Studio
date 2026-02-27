export interface ContextPromptRunResult {
  result: string
  error: string | null
}

export async function runContextPrompt(
  contextPrompt: string,
  resumeJson: unknown,
  signal?: AbortSignal,
): Promise<ContextPromptRunResult> {
  if (!contextPrompt.trim())
    return {
      result: "",
      error: "Context prompt is empty. Add blocks to the context canvas first.",
    }

  try {
    const res = await fetch("/api/context-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextPrompt, resumeJson }),
      signal,
    })

    const data = await res.json()

    if (!res.ok)
      return {
        result: "",
        error: data?.error ?? `Request failed (${res.status})`,
      }

    return {
      result: data.result ?? "",
      error: null,
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    return {
      result: "",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

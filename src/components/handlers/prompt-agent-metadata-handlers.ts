interface PromptAgentMetadataResponse {
  agentMetadata?: string | null
  error?: string
}

interface UpdatePromptAgentMetadataResponse {
  promptId?: string
  error?: string
}

function getStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value
}

function parseJsonObject(value: string): unknown {
  return JSON.parse(value)
}

export function formatAgentMetadataForEditor(agentMetadata: string): string {
  const trimmedAgentMetadata = agentMetadata.trim()
  if (!trimmedAgentMetadata)
    return ""

  try {
    const parsed = parseJsonObject(trimmedAgentMetadata)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return agentMetadata
  }
}

export function validateAgentMetadataJson(agentMetadata: string): string | null {
  const trimmedAgentMetadata = agentMetadata.trim()
  if (!trimmedAgentMetadata)
    return "Agent metadata is required"

  try {
    const parsed = parseJsonObject(trimmedAgentMetadata)
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
      return "Agent metadata must be a JSON object"

    return null
  } catch {
    return "Agent metadata JSON is invalid"
  }
}

interface ParseAgentMetadataResult {
  metadata: Record<string, unknown>
  error: string | null
}

interface ParsePrimitiveResult {
  value: unknown
  error: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function parseAgentMetadataRecord(agentMetadata: string): ParseAgentMetadataResult {
  const trimmedAgentMetadata = agentMetadata.trim()
  if (!trimmedAgentMetadata)
    return { metadata: {}, error: null }

  try {
    const parsed = parseJsonObject(trimmedAgentMetadata)
    if (!isRecord(parsed))
      return { metadata: {}, error: "Agent metadata must be a JSON object" }

    return { metadata: parsed, error: null }
  } catch {
    return { metadata: {}, error: "Agent metadata JSON is invalid" }
  }
}

export function formatPrimitiveMetadataValue(value: unknown): string {
  if (typeof value === "string")
    return value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (value === null)
    return "null"

  return ""
}

export function parsePrimitiveMetadataValue(currentValue: unknown, nextRawValue: string): ParsePrimitiveResult {
  if (typeof currentValue === "string")
    return { value: nextRawValue, error: null }

  if (typeof currentValue === "number") {
    const nextNumberValue = Number(nextRawValue.trim())
    if (!Number.isFinite(nextNumberValue))
      return { value: currentValue, error: "Number fields must contain a valid number" }

    return { value: nextNumberValue, error: null }
  }

  if (typeof currentValue === "boolean") {
    const normalizedValue = nextRawValue.trim().toLowerCase()
    if (normalizedValue === "true")
      return { value: true, error: null }
    if (normalizedValue === "false")
      return { value: false, error: null }

    return { value: currentValue, error: "Boolean fields must be true or false" }
  }

  if (currentValue === null) {
    const normalizedValue = nextRawValue.trim().toLowerCase()
    if (normalizedValue === "null")
      return { value: null, error: null }

    return { value: currentValue, error: "Null fields must remain null" }
  }

  return { value: currentValue, error: "Only primitive values can be edited directly" }
}

export function updateMetadataAtPath(
  rootValue: Record<string, unknown>,
  path: Array<string | number>,
  nextPrimitiveValue: unknown,
): Record<string, unknown> {
  if (path.length === 0)
    return rootValue

  const [firstPathSegment, ...restPath] = path

  if (typeof firstPathSegment === "number")
    return rootValue

  if (restPath.length === 0) {
    return {
      ...rootValue,
      [firstPathSegment]: nextPrimitiveValue,
    }
  }

  const nestedValue = rootValue[firstPathSegment]

  if (Array.isArray(nestedValue)) {
    const updatedArray = nestedValue.map((entryValue, entryIndex) => {
      if (entryIndex !== restPath[0] || restPath.length === 1)
        return entryValue

      if (entryValue !== null && typeof entryValue === "object")
        return updateMetadataAtPath(entryValue as Record<string, unknown>, restPath.slice(1), nextPrimitiveValue)

      return entryValue
    })

    if (restPath.length === 1 && typeof restPath[0] === "number") {
      const entryIndex = restPath[0]
      if (entryIndex >= 0 && entryIndex < updatedArray.length)
        updatedArray[entryIndex] = nextPrimitiveValue
    }

    return {
      ...rootValue,
      [firstPathSegment]: updatedArray,
    }
  }

  if (nestedValue !== null && typeof nestedValue === "object") {
    return {
      ...rootValue,
      [firstPathSegment]: updateMetadataAtPath(
        nestedValue as Record<string, unknown>,
        restPath,
        nextPrimitiveValue,
      ),
    }
  }

  return rootValue
}

export function stringifyAgentMetadataRecord(agentMetadata: Record<string, unknown>): string {
  return JSON.stringify(agentMetadata, null, 2)
}

function getMetadataValueAtPath(
  rootValue: Record<string, unknown>,
  path: Array<string | number>,
): unknown {
  let currentValue: unknown = rootValue

  for (const pathSegment of path) {
    if (typeof pathSegment === "number") {
      if (!Array.isArray(currentValue))
        return undefined
      currentValue = currentValue[pathSegment]
      continue
    }

    if (currentValue === null || typeof currentValue !== "object" || Array.isArray(currentValue))
      return undefined

    currentValue = (currentValue as Record<string, unknown>)[pathSegment]
  }

  return currentValue
}

interface ApplyPrimitiveMetadataChangeResult {
  metadata: Record<string, unknown>
  error: string | null
}

export function applyPrimitiveMetadataChange(
  metadata: Record<string, unknown>,
  path: Array<string | number>,
  nextRawValue: string,
): ApplyPrimitiveMetadataChangeResult {
  const currentValue = getMetadataValueAtPath(metadata, path)
  const parseResult = parsePrimitiveMetadataValue(currentValue, nextRawValue)
  if (parseResult.error)
    return { metadata, error: parseResult.error }

  return {
    metadata: updateMetadataAtPath(metadata, path, parseResult.value),
    error: null,
  }
}

export async function getPromptAgentMetadataById(promptId: string): Promise<string> {
  const response = await fetch(`/api/prompt-string?promptId=${encodeURIComponent(promptId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: PromptAgentMetadataResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch prompt agent metadata")

  return getStringValue(body?.agentMetadata)
}

export async function updatePromptAgentMetadataById(promptId: string, agentMetadata: string): Promise<void> {
  const response = await fetch("/api/prompt-string", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptId,
      agentMetadata,
    }),
  })

  let body: UpdatePromptAgentMetadataResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to update prompt agent metadata")
}

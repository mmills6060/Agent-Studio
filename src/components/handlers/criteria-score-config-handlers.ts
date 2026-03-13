interface CriteriaScoreConfigRow {
  indicatorId: string
  indicatorName: string
  minScore: number
  maxScore: number
}

interface CriteriaScoreConfigResponse {
  rows?: Array<Record<string, unknown>>
  error?: string
}

interface UpdateCriteriaScoreConfigResponse {
  indicatorId?: string
  error?: string
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return value

  if (typeof value === "string") {
    const parsedValue = Number(value)
    if (Number.isFinite(parsedValue))
      return parsedValue
  }

  return null
}

function parseCriteriaScoreConfigRow(row: Record<string, unknown>): CriteriaScoreConfigRow | null {
  const indicatorId = row.indicatorId
  const indicatorName = row.indicatorName
  const minScore = parseNumberValue(row.minScore)
  const maxScore = parseNumberValue(row.maxScore)

  if (typeof indicatorId !== "string" || typeof indicatorName !== "string" || minScore === null || maxScore === null)
    return null

  return {
    indicatorId,
    indicatorName,
    minScore,
    maxScore,
  }
}

export async function getCriteriaScoreConfig(criteriaId: string): Promise<CriteriaScoreConfigRow[]> {
  const response = await fetch(`/api/criteria-score-config?criteriaId=${encodeURIComponent(criteriaId)}`, {
    method: "GET",
    cache: "no-store",
  })

  let body: CriteriaScoreConfigResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to fetch score config")

  if (!Array.isArray(body?.rows))
    return []

  return body.rows
    .map((row) => parseCriteriaScoreConfigRow(row))
    .filter((row): row is CriteriaScoreConfigRow => row !== null)
}

export async function updateIndicatorScoreConfig(
  indicatorId: string,
  minScore: number,
  maxScore: number,
): Promise<void> {
  const response = await fetch("/api/criteria-score-config", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      indicatorId,
      minScore,
      maxScore,
    }),
  })

  let body: UpdateCriteriaScoreConfigResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    throw new Error(body?.error ?? "Failed to update score config")
}

export type { CriteriaScoreConfigRow }

interface DatabaseConnectionResponse {
  connected?: boolean
  checkedAt?: string
  error?: string
}

export interface DatabaseConnectionStatus {
  isConnected: boolean
  checkedAt?: string
  error?: string
}

export async function testDatabaseConnection(): Promise<DatabaseConnectionStatus> {
  const response = await fetch("/api/sql-query", {
    method: "GET",
    cache: "no-store",
  })

  let body: DatabaseConnectionResponse | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok)
    return {
      isConnected: false,
      error: body?.error ?? "Connection test failed",
    }

  if (!body?.connected)
    return {
      isConnected: false,
      error: "Database did not report a successful connection",
    }

  return {
    isConnected: true,
    checkedAt: body.checkedAt,
  }
}

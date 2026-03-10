import { cookies } from "next/headers"

export type DbEnvironment = "dev" | "prod"

export async function getEnvironment(): Promise<DbEnvironment> {
  const cookieStore = await cookies()
  const value = cookieStore.get("environment")?.value
  return value === "dev" ? "dev" : "prod"
}

import PromptWorkspace from "@/components/prompt-workspace"
import { getOrganizations } from "@/app/handlers/page-handlers"
import { getEnvironment } from "@/lib/environment"

export default async function Home() {
  const environment = await getEnvironment()
  const organizations = await getOrganizations(environment)
  return <PromptWorkspace organizations={organizations} defaultEnvironment={environment} />
}

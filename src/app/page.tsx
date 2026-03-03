import PromptWorkspace from "@/components/prompt-workspace"
import { getOrganizations } from "@/app/handlers/page-handlers"

export default async function Home() {
  const organizations = await getOrganizations()
  return <PromptWorkspace organizations={organizations} />
}

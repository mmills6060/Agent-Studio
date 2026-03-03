import type { ScoringPromptTab } from "@/components/handlers/scoring-prompt-manager-handlers"

interface AppSidebarOrganization {
  orgId: string
  orgName: string
}

interface AppSidebarJobRole {
  roleId: string
  roleDescription: string
}

interface AppSidebarPromptReference {
  promptId: string
}

interface AppSidebarProps {
  activeTab: string
  scoringTabs: ScoringPromptTab[]
  organizations: AppSidebarOrganization[]
  selectedOrganizationId: string | null
  jobRoles: AppSidebarJobRole[]
  isLoadingJobRoles: boolean
  jobRolesError: string | null
  selectedJobRoleId: string | null
  promptReferences: AppSidebarPromptReference[]
  isLoadingPromptReferences: boolean
  promptReferencesError: string | null
  promptImportError: string | null
  editingTabId: string | null
  editingName: string
  onSwitchTab: (tabId: string) => void
  onAddScoringTab: () => void
  onDeleteScoringTab: (tabId: string) => void
  onStartRename: (tabId: string) => void
  onFinishRename: () => void
  onEditingNameChange: (name: string) => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
  onReorderScoringTabs: (activeId: string, overId: string) => void
  onSelectOrganization: (orgId: string) => void
  onSelectJobRole: (roleId: string) => void
  onSelectPromptReference: (promptId: string) => void
}

export type {
  AppSidebarJobRole,
  AppSidebarOrganization,
  AppSidebarPromptReference,
  AppSidebarProps,
}

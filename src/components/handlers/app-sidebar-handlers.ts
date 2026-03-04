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

interface AppSidebarCriteria {
  criteriaId: string
  criteriaName: string
}

interface AppSidebarProps {
  activeTab: string
  scoringTabs: ScoringPromptTab[]
  organizations: AppSidebarOrganization[]
  selectedOrganizationId: string | null
  jobRoles: AppSidebarJobRole[]
  isLoadingJobRoles: boolean
  isCreatingJobRole: boolean
  jobRolesError: string | null
  selectedJobRoleId: string | null
  promptReferences: AppSidebarPromptReference[]
  isLoadingPromptReferences: boolean
  promptReferencesError: string | null
  criteriaByPromptId: Record<string, AppSidebarCriteria[]>
  isLoadingCriteria: boolean
  isCreatingCriteriaNode: boolean
  criteriaError: string | null
  promptImportError: string | null
  criteriaImportError: string | null
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
  onCreateJobRole: (assessmentInstanceName: string) => Promise<void>
  onSelectJobRole: (roleId: string) => void
  onSelectPromptReference: (promptId: string) => void
  onSelectCriteria: (criteriaId: string, promptId: string) => void
  onCreateCriteriaNode: (promptId: string, criteriaName: string, minScore: number, maxScore: number) => Promise<void>
}

export type {
  AppSidebarJobRole,
  AppSidebarOrganization,
  AppSidebarCriteria,
  AppSidebarPromptReference,
  AppSidebarProps,
}

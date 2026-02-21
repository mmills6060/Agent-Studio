import type { ScoringPromptTab } from "@/components/handlers/scoring-prompt-manager-handlers"

interface AppSidebarProps {
  activeTab: string
  scoringTabs: ScoringPromptTab[]
  editingTabId: string | null
  editingName: string
  onSwitchTab: (tabId: string) => void
  onAddScoringTab: () => void
  onDeleteScoringTab: (tabId: string) => void
  onStartRename: (tabId: string) => void
  onFinishRename: () => void
  onEditingNameChange: (name: string) => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
}

export type { AppSidebarProps }

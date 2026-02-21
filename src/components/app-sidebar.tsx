"use client"

import { Phone, ClipboardCheck, Plus, X, ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import type { AppSidebarProps } from "@/components/handlers/app-sidebar-handlers"

export default function AppSidebar({
  activeTab,
  scoringTabs,
  editingTabId,
  editingName,
  onSwitchTab,
  onAddScoringTab,
  onDeleteScoringTab,
  onStartRename,
  onFinishRename,
  onEditingNameChange,
  onRenameKeyDown,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeTab === "call-prompt"}
                onClick={() => onSwitchTab("call-prompt")}
              >
                <Phone />
                <span>Call Prompt</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton>
                    <ClipboardCheck />
                    <span>Scoring Prompts</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <SidebarMenuAction onClick={onAddScoringTab} title="Add scoring prompt">
                  <Plus />
                </SidebarMenuAction>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {scoringTabs.map((tab) => (
                      <SidebarMenuSubItem key={tab.id} className="group/scoring-item">
                        {editingTabId === tab.id ? (
                          <input
                            value={editingName}
                            onChange={(e) => onEditingNameChange(e.target.value)}
                            onBlur={onFinishRename}
                            onKeyDown={onRenameKeyDown}
                            className="h-7 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none"
                            autoFocus
                          />
                        ) : (
                          <SidebarMenuSubButton
                            isActive={tab.id === activeTab}
                            onClick={() => onSwitchTab(tab.id)}
                            onDoubleClick={() => onStartRename(tab.id)}
                            className="relative pr-6"
                          >
                            <span className="truncate">{tab.name}</span>
                          </SidebarMenuSubButton>
                        )}
                        {scoringTabs.length > 1 && editingTabId !== tab.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteScoringTab(tab.id)
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-sidebar-foreground/50 opacity-0 transition-opacity hover:text-sidebar-foreground group-hover/scoring-item:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

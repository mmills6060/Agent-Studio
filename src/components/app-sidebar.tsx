"use client"

import { Phone, ClipboardCheck, Plus, X, ChevronRight, Pencil } from "lucide-react"
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
                            className="relative pr-10"
                          >
                            <span className="truncate">{tab.name}</span>
                          </SidebarMenuSubButton>
                        )}
                        {editingTabId !== tab.id && (
                          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/scoring-item:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onStartRename(tab.id)
                              }}
                              className="rounded-sm p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                              title="Rename"
                            >
                              <Pencil className="size-3" />
                            </button>
                            {scoringTabs.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteScoringTab(tab.id)
                                }}
                                className="rounded-sm p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                                title="Delete"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
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

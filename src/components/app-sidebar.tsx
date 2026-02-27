"use client"

import { useState } from "react"
import { Phone, FileText, ClipboardCheck, Plus, X, ChevronRight, Pencil, GripVertical } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
import type { ScoringPromptTab } from "@/components/handlers/scoring-prompt-manager-handlers"

interface SortableScoringTabProps {
  tab: ScoringPromptTab
  activeTab: string
  editingTabId: string | null
  editingName: string
  scoringTabsLength: number
  onSwitchTab: (tabId: string) => void
  onDeleteScoringTab: (tabId: string) => void
  onStartRename: (tabId: string) => void
  onFinishRename: () => void
  onEditingNameChange: (name: string) => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
}

function SortableScoringTab({
  tab,
  activeTab,
  editingTabId,
  editingName,
  scoringTabsLength,
  onSwitchTab,
  onDeleteScoringTab,
  onStartRename,
  onFinishRename,
  onEditingNameChange,
  onRenameKeyDown,
}: SortableScoringTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <SidebarMenuSubItem
      ref={setNodeRef}
      style={style}
      className="group/scoring-item"
    >
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
          <span
            {...attributes}
            {...listeners}
            className="flex shrink-0 cursor-grab items-center text-sidebar-foreground/50 active:cursor-grabbing"
          >
            <GripVertical className="size-3" />
          </span>
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
          {scoringTabsLength > 1 && (
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
  )
}

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
  onReorderScoringTabs,
}: AppSidebarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false)
    const { active, over } = event
    if (over && active.id !== over.id)
      onReorderScoringTabs(active.id as string, over.id as string)
  }

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

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeTab === "context-prompt"}
                onClick={() => onSwitchTab("context-prompt")}
              >
                <FileText />
                <span>Context Prompt</span>
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
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={handleDragEnd}
                      onDragCancel={() => setIsDragging(false)}
                    >
                      <SortableContext
                        items={scoringTabs.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {scoringTabs.map((tab) => (
                          <SortableScoringTab
                            key={tab.id}
                            tab={tab}
                            activeTab={isDragging ? "" : activeTab}
                            editingTabId={editingTabId}
                            editingName={editingName}
                            scoringTabsLength={scoringTabs.length}
                            onSwitchTab={onSwitchTab}
                            onDeleteScoringTab={onDeleteScoringTab}
                            onStartRename={onStartRename}
                            onFinishRename={onFinishRename}
                            onEditingNameChange={onEditingNameChange}
                            onRenameKeyDown={onRenameKeyDown}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
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

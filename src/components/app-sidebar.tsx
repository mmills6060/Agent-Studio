"use client"

import { useState } from "react"
import { Phone, FileText, ClipboardCheck, Plus, X, ChevronRight, Pencil, GripVertical, Building2, BriefcaseBusiness, Hash, ListChecks } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  organizations,
  selectedOrganizationId,
  jobRoles,
  isLoadingJobRoles,
  isCreatingJobRole,
  jobRolesError,
  selectedJobRoleId,
  promptReferences,
  isLoadingPromptReferences,
  promptReferencesError,
  criteriaByPromptId,
  isLoadingCriteria,
  isCreatingCriteriaNode,
  criteriaError,
  promptImportError,
  criteriaImportError,
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
  onSelectOrganization,
  onCreateJobRole,
  onSelectJobRole,
  onSelectPromptReference,
  onSelectCriteria,
  onCreateCriteriaNode,
}: AppSidebarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [assessmentInstanceName, setAssessmentInstanceName] = useState("")
  const [createRoleError, setCreateRoleError] = useState<string | null>(null)
  const [isCreateCriteriaOpen, setIsCreateCriteriaOpen] = useState(false)
  const [criteriaName, setCriteriaName] = useState("")
  const [minScore, setMinScore] = useState("")
  const [maxScore, setMaxScore] = useState("")
  const [targetPromptId, setTargetPromptId] = useState<string | null>(null)
  const [createCriteriaError, setCreateCriteriaError] = useState<string | null>(null)
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

  async function handleCreateRoleSubmit() {
    const trimmedAssessmentInstanceName = assessmentInstanceName.trim()
    if (!trimmedAssessmentInstanceName) {
      setCreateRoleError("Assessment instance name is required")
      return
    }

    setCreateRoleError(null)
    try {
      await onCreateJobRole(trimmedAssessmentInstanceName)
      setAssessmentInstanceName("")
      setIsCreateRoleOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create role"
      setCreateRoleError(message)
    }
  }

  async function handleCreateCriteriaSubmit() {
    const promptId = targetPromptId?.trim() ?? ""
    if (!promptId) {
      setCreateCriteriaError("Prompt ID is required")
      return
    }

    const trimmedCriteriaName = criteriaName.trim()
    if (!trimmedCriteriaName) {
      setCreateCriteriaError("Criteria name is required")
      return
    }

    const parsedMinScore = Number(minScore.trim())
    if (!Number.isFinite(parsedMinScore)) {
      setCreateCriteriaError("Min score is required")
      return
    }

    const parsedMaxScore = Number(maxScore.trim())
    if (!Number.isFinite(parsedMaxScore)) {
      setCreateCriteriaError("Max score is required")
      return
    }

    if (parsedMinScore > parsedMaxScore) {
      setCreateCriteriaError("Min score must be less than or equal to max score")
      return
    }

    setCreateCriteriaError(null)
    try {
      await onCreateCriteriaNode(promptId, trimmedCriteriaName, parsedMinScore, parsedMaxScore)
      setCriteriaName("")
      setMinScore("")
      setMaxScore("")
      setTargetPromptId(null)
      setIsCreateCriteriaOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create criteria node"
      setCreateCriteriaError(message)
    }
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
        <SidebarGroup>
          <SidebarGroupLabel>Organizations</SidebarGroupLabel>
          <SidebarMenu>
            {organizations.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <Building2 />
                  <span>No organizations found</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              organizations.map((organization) => (
                <SidebarMenuItem key={organization.orgId}>
                  <SidebarMenuButton
                    isActive={selectedOrganizationId === organization.orgId}
                    onClick={() => onSelectOrganization(organization.orgId)}
                  >
                    <Building2 />
                    <span>{organization.orgName}</span>
                  </SidebarMenuButton>
                  {selectedOrganizationId === organization.orgId && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateRoleError(null)
                              setAssessmentInstanceName("")
                              setIsCreateRoleOpen(true)
                            }}
                            className="w-full text-left"
                          >
                            <Plus />
                            <span>Create role</span>
                          </button>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {isLoadingJobRoles ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <button type="button" disabled>
                              <BriefcaseBusiness />
                              <span>Loading roles...</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : jobRolesError ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <button type="button" disabled>
                              <BriefcaseBusiness />
                              <span>{jobRolesError}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : jobRoles.length === 0 ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <button type="button" disabled>
                              <BriefcaseBusiness />
                              <span>No roles found</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : (
                        jobRoles.map((jobRole) => (
                          <SidebarMenuSubItem key={jobRole.roleId}>
                            <SidebarMenuSubButton asChild>
                              <button
                                type="button"
                                onClick={() => onSelectJobRole(jobRole.roleId)}
                                className="w-full text-left"
                              >
                                <BriefcaseBusiness />
                                <span>{jobRole.roleDescription}</span>
                              </button>
                            </SidebarMenuSubButton>
                            {selectedJobRoleId === jobRole.roleId && (
                              <SidebarMenuSub>
                                {isLoadingPromptReferences ? (
                                  <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild>
                                      <button type="button" disabled>
                                        <span>Loading prompts...</span>
                                      </button>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ) : promptReferencesError ? (
                                  <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild>
                                      <button type="button" disabled>
                                        <Hash />
                                        <span>{promptReferencesError}</span>
                                      </button>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ) : promptReferences.length === 0 ? (
                                  <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild>
                                      <button type="button" disabled>
                                        <Hash />
                                        <span>No prompt IDs found</span>
                                      </button>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ) : (
                                  <>
                                    {promptReferences.flatMap((reference) => [
                                      <SidebarMenuSubItem key={reference.promptId}>
                                        <SidebarMenuSubButton asChild>
                                          <button
                                            type="button"
                                            onClick={() => onSelectPromptReference(reference.promptId)}
                                            className="w-full text-left"
                                          >
                                            <Phone />
                                            <span>Call Prompt</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>,
                                      <SidebarMenuSubItem key={`create-criteria-${reference.promptId}`}>
                                        <SidebarMenuSubButton asChild>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCreateCriteriaError(null)
                                              setCriteriaName("")
                                              setMinScore("")
                                              setMaxScore("")
                                              setTargetPromptId(reference.promptId)
                                              setIsCreateCriteriaOpen(true)
                                            }}
                                            className="w-full text-left"
                                          >
                                            <Plus />
                                            <span>Create criteria node</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>,
                                      ...(isLoadingCriteria
                                        ? []
                                        : criteriaError
                                          ? []
                                          : (criteriaByPromptId[reference.promptId] ?? []).map((criteria) => (
                                              <SidebarMenuSubItem key={`${reference.promptId}-${criteria.criteriaId}`}>
                                                <SidebarMenuSubButton asChild>
                                                  <button
                                                    type="button"
                                                    onClick={() => onSelectCriteria(criteria.criteriaId)}
                                                    className="w-full text-left"
                                                  >
                                                    <ListChecks />
                                                    <span>{criteria.criteriaName}</span>
                                                  </button>
                                                </SidebarMenuSubButton>
                                              </SidebarMenuSubItem>
                                            ))),
                                    ])}
                                    {isLoadingCriteria && (
                                      <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                          <button type="button" disabled>
                                            <ListChecks />
                                            <span>Loading criteria...</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    )}
                                    {criteriaError && !isLoadingCriteria && (
                                      <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                          <button type="button" disabled>
                                            <ListChecks />
                                            <span>{criteriaError}</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    )}
                                    {criteriaImportError && (
                                      <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                          <button type="button" disabled>
                                            <ListChecks />
                                            <span>{criteriaImportError}</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    )}
                                    {promptImportError && (
                                      <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild>
                                          <button type="button" disabled>
                                            <Hash />
                                            <span>{promptImportError}</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    )}
                                  </>
                                )}
                              </SidebarMenuSub>
                            )}
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <Dialog
        open={isCreateRoleOpen}
        onOpenChange={(open) => {
          setIsCreateRoleOpen(open)
          if (!open) {
            setCreateRoleError(null)
            setAssessmentInstanceName("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Create a role and add an assessment instance with type JOB.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="assessment-instance-name" className="text-sm font-medium text-foreground">
              Assessment instance name
            </label>
            <Input
              id="assessment-instance-name"
              value={assessmentInstanceName}
              onChange={(event) => setAssessmentInstanceName(event.target.value)}
              placeholder="e.g. Senior Account Executive"
              disabled={isCreatingJobRole}
            />
            {createRoleError && (
              <p className="text-sm text-destructive">{createRoleError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateRoleOpen(false)}
              disabled={isCreatingJobRole}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateRoleSubmit} disabled={isCreatingJobRole}>
              {isCreatingJobRole ? "Creating..." : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isCreateCriteriaOpen}
        onOpenChange={(open) => {
          setIsCreateCriteriaOpen(open)
          if (!open) {
            setCreateCriteriaError(null)
            setCriteriaName("")
            setMinScore("")
            setMaxScore("")
            setTargetPromptId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create criteria node</DialogTitle>
            <DialogDescription>
              Add a new criteria node to this prompt for the selected role.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="criteria-node-name" className="text-sm font-medium text-foreground">
              Criteria name
            </label>
            <Input
              id="criteria-node-name"
              value={criteriaName}
              onChange={(event) => setCriteriaName(event.target.value)}
              placeholder="e.g. Clinical confidence"
              disabled={isCreatingCriteriaNode}
            />
            <label htmlFor="criteria-node-min-score" className="text-sm font-medium text-foreground">
              Min score
            </label>
            <Input
              id="criteria-node-min-score"
              type="number"
              value={minScore}
              onChange={(event) => setMinScore(event.target.value)}
              placeholder="e.g. 0"
              disabled={isCreatingCriteriaNode}
            />
            <label htmlFor="criteria-node-max-score" className="text-sm font-medium text-foreground">
              Max score
            </label>
            <Input
              id="criteria-node-max-score"
              type="number"
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
              placeholder="e.g. 10"
              disabled={isCreatingCriteriaNode}
            />
            {createCriteriaError && (
              <p className="text-sm text-destructive">{createCriteriaError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateCriteriaOpen(false)}
              disabled={isCreatingCriteriaNode}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCriteriaSubmit} disabled={isCreatingCriteriaNode}>
              {isCreatingCriteriaNode ? "Creating..." : "Create criteria node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Node, Edge } from "@xyflow/react"
import FlowCanvas from "@/components/flow-canvas"
import type { FlowCanvasRef } from "@/components/flow-canvas"
import ContextFlowCanvas from "@/components/context-flow-canvas"
import type { ContextFlowCanvasRef } from "@/components/context-flow-canvas"
import ScoringFlowCanvas from "@/components/scoring-flow-canvas"
import type { ScoringFlowCanvasRef } from "@/components/scoring-flow-canvas"
import ConversationPanel from "@/components/conversation-panel"
import ScoringResultsPanel from "@/components/scoring-results-panel"
import type { ConversationMessage } from "@/components/handlers/conversation-handlers"
import {
  createScoringPromptTab,
  renameScoringPromptTab,
  deleteScoringPromptTab,
  saveScoringPromptTabState,
  type ScoringPromptTab,
} from "@/components/handlers/scoring-prompt-manager-handlers"
import type { ScoringNodeData } from "@/components/handlers/scoring-flow-canvas-handlers"
import { generateScoringPrompt } from "@/components/handlers/scoring-flow-canvas-handlers"
import type { ContextNodeData } from "@/components/handlers/context-flow-canvas-handlers"
import { Play, Upload, MessageSquare, BarChart3, Save, Check, Trash2, Wand2, PlayCircle, Square, UploadCloud, Loader2 } from "lucide-react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import AddNodeToolbar from "@/components/add-node-toolbar"
import AppSidebar from "@/components/app-sidebar"
import { ALL_SCORING_BLOCK_TYPES } from "@/lib/scoring-block-types"
import { ALL_CONTEXT_BLOCK_TYPES } from "@/lib/context-block-types"
import { saveWorkspace, loadWorkspace, clearWorkspace } from "@/components/handlers/workspace-save-handlers"
import PromptWizard from "@/components/prompt-wizard"
import type { WizardResult } from "@/components/handlers/prompt-wizard-handlers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_RESUME_JSON } from "@/lib/default-resume"
import { runContextPrompt } from "@/components/handlers/context-prompt-run-handlers"
import { getCriteriaScoringPromptById, updateCriteriaScoringPrompt } from "@/components/handlers/criteria-scoring-prompt-handlers"
import { createJobRole, getJobRolesByOrganization } from "@/components/handlers/job-roles-handlers"
import { createCandidateContextPrompt, getCandidateContextPrompt, updateCandidateContextPrompt } from "@/components/handlers/candidate-context-prompt-handlers"
import { getPromptReferencesByRole } from "@/components/handlers/prompt-references-handlers"
import { getPromptStringById } from "@/components/handlers/prompt-string-handlers"
import { updatePromptStringById } from "@/components/handlers/update-prompt-string-handlers"
import { getCriteriaByRole } from "@/components/handlers/role-criteria-handlers"
import { createCriteriaNode } from "@/components/handlers/create-criteria-node-handlers"
import { loadAllRoleScoringPrompts } from "@/components/handlers/load-all-role-scoring-prompts-handlers"
import type { AppSidebarCriteria, AppSidebarJobRole, AppSidebarOrganization, AppSidebarPromptReference } from "@/components/handlers/app-sidebar-handlers"
import { ThemeToggle } from "@/components/theme-toggle"

const DEFAULT_RESUME_JSON_STRING = JSON.stringify(DEFAULT_RESUME_JSON, null, 2)

const firstScoringTab = createScoringPromptTab()

interface PromptWorkspaceProps {
  organizations: AppSidebarOrganization[]
  defaultEnvironment?: "dev" | "prod"
}

export default function PromptWorkspace({ organizations, defaultEnvironment = "prod" }: PromptWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<string>("call-prompt")
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [jobRoles, setJobRoles] = useState<AppSidebarJobRole[]>([])
  const [isLoadingJobRoles, setIsLoadingJobRoles] = useState(false)
  const [isCreatingJobRole, setIsCreatingJobRole] = useState(false)
  const [isCreatingContextPrompt, setIsCreatingContextPrompt] = useState(false)
  const [jobRolesError, setJobRolesError] = useState<string | null>(null)
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string | null>(null)
  const [promptReferences, setPromptReferences] = useState<AppSidebarPromptReference[]>([])
  const [isLoadingPromptReferences, setIsLoadingPromptReferences] = useState(false)
  const [promptReferencesError, setPromptReferencesError] = useState<string | null>(null)
  const [criteriaByPromptId, setCriteriaByPromptId] = useState<Record<string, AppSidebarCriteria[]>>({})
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(false)
  const [isCreatingCriteriaNode, setIsCreatingCriteriaNode] = useState(false)
  const [criteriaError, setCriteriaError] = useState<string | null>(null)
  const [promptImportError, setPromptImportError] = useState<string | null>(null)
  const [criteriaImportError, setCriteriaImportError] = useState<string | null>(null)
  const [scoringTabs, setScoringTabs] = useState<ScoringPromptTab[]>([firstScoringTab])
  const [currentScoringTabId, setCurrentScoringTabId] = useState(firstScoringTab.id)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isConversationOpen, setIsConversationOpen] = useState(false)
  const [conversationPrompt, setConversationPrompt] = useState("")
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [isScoringResultsOpen, setIsScoringResultsOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [contextPromptState, setContextPromptState] = useState<{
    nodes: Node<ContextNodeData>[]
    edges: Edge[]
  }>({ nodes: [], edges: [] })
  const [isContextRunOpen, setIsContextRunOpen] = useState(false)
  const [resumeJsonText, setResumeJsonText] = useState(DEFAULT_RESUME_JSON_STRING)
  const [contextRunResult, setContextRunResult] = useState<string | null>(null)
  const [contextRunError, setContextRunError] = useState<string | null>(null)
  const [isContextRunning, setIsContextRunning] = useState(false)
  const [isLoadingPromptIntoCanvas, setIsLoadingPromptIntoCanvas] = useState(false)
  const [isLoadingAllRolePrompts, setIsLoadingAllRolePrompts] = useState(false)
  const contextRunAbortRef = useRef<AbortController | null>(null)
  const canvasRef = useRef<ScoringFlowCanvasRef>(null)
  const flowCanvasRef = useRef<FlowCanvasRef>(null)
  const contextFlowCanvasRef = useRef<ContextFlowCanvasRef>(null)

  const isCallPrompt = activeTab === "call-prompt"
  const isContextPrompt = activeTab === "context-prompt"
  const scoringTabToRender = scoringTabs.find((t) => t.id === currentScoringTabId) ?? scoringTabs[0]

  const saveCurrentCanvasState = useCallback(() => {
    if (!canvasRef.current || isCallPrompt || isContextPrompt) return
    const { nodes, edges } = canvasRef.current.getState()
    setScoringTabs((prev) => saveScoringPromptTabState(prev, activeTab, nodes, edges))
  }, [activeTab, isCallPrompt, isContextPrompt])

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return
      saveCurrentCanvasState()
      if (isContextPrompt) {
        const state = contextFlowCanvasRef.current?.getState()
        if (state) setContextPromptState(state)
      }
      if (isCallPrompt) flowCanvasRef.current?.deselectAll()
      else if (isContextPrompt) contextFlowCanvasRef.current?.deselectAll()
      else canvasRef.current?.deselectAll()
      if (tabId !== "call-prompt" && tabId !== "context-prompt")
        setCurrentScoringTabId(tabId)
      setActiveTab(tabId)
    },
    [activeTab, isCallPrompt, isContextPrompt, saveCurrentCanvasState],
  )

  const handleAddScoringTab = useCallback(() => {
    saveCurrentCanvasState()
    const newTab = createScoringPromptTab()
    setScoringTabs((prev) => [...prev, newTab])
    setCurrentScoringTabId(newTab.id)
    setActiveTab(newTab.id)
  }, [saveCurrentCanvasState])

  const handleDeleteScoringTab = useCallback(
    (tabId: string) => {
      if (scoringTabs.length <= 1) return
      saveCurrentCanvasState()
      const updated = deleteScoringPromptTab(scoringTabs, tabId)
      setScoringTabs(updated)
      setScoringProductionPromptByTab((prev) => {
        const next = { ...prev }
        delete next[tabId]
        return next
      })
      const deletedIndex = scoringTabs.findIndex((t) => t.id === tabId)
      const nextTab = updated[Math.min(deletedIndex, updated.length - 1)]
      if (activeTab === tabId) setActiveTab(nextTab.id)
      if (currentScoringTabId === tabId) setCurrentScoringTabId(nextTab.id)
    },
    [scoringTabs, activeTab, currentScoringTabId, saveCurrentCanvasState],
  )

  const handleStartRename = useCallback(
    (tabId: string) => {
      const tab = scoringTabs.find((t) => t.id === tabId)
      if (!tab) return
      setEditingTabId(tabId)
      setEditingName(tab.name)
    },
    [scoringTabs],
  )

  const handleFinishRename = useCallback(() => {
    if (!editingTabId) return
    const trimmed = editingName.trim()
    if (trimmed) setScoringTabs((prev) => renameScoringPromptTab(prev, editingTabId, trimmed))
    setEditingTabId(null)
    setEditingName("")
  }, [editingTabId, editingName])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleFinishRename()
      if (e.key === "Escape") {
        setEditingTabId(null)
        setEditingName("")
      }
    },
    [handleFinishRename],
  )

  const handleReorderScoringTabs = useCallback((activeId: string, overId: string) => {
    setScoringTabs((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === activeId)
      const newIndex = prev.findIndex((t) => t.id === overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(oldIndex, 1)
      updated.splice(newIndex, 0, moved)
      return updated
    })
  }, [])

  const handleOpenConversation = useCallback(() => {
    const prompt = flowCanvasRef.current?.getPrompt() ?? ""
    setConversationPrompt(prompt)
    setIsConversationOpen(true)
  }, [])

  const handleOpenScoringResults = useCallback(() => {
    saveCurrentCanvasState()
    setIsScoringResultsOpen(true)
  }, [saveCurrentCanvasState])

  const handleLoadAllRoleScoringPrompts = useCallback(async () => {
    if (isLoadingAllRolePrompts) return
    setIsLoadingAllRolePrompts(true)
    try {
      const { tabs, criteriaByTabId } = await loadAllRoleScoringPrompts(criteriaByPromptId)
      if (tabs.length === 0) return
      setScoringTabs(tabs)
      setCurrentScoringTabId(tabs[0].id)
      setActiveTab(tabs[0].id)
      setScoringProductionCriteriaByTab(criteriaByTabId)
    } finally {
      setIsLoadingAllRolePrompts(false)
    }
  }, [isLoadingAllRolePrompts, criteriaByPromptId])

  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [callProductionPromptId, setCallProductionPromptId] = useState<string | null>(null)
  const [contextProductionPromptId, setContextProductionPromptId] = useState<string | null>(null)
  const [scoringProductionPromptByTab, setScoringProductionPromptByTab] = useState<Record<string, string>>({})
  const [scoringProductionCriteriaByTab, setScoringProductionCriteriaByTab] = useState<Record<string, string>>({})

  const activeProductionPromptId = isCallPrompt
    ? callProductionPromptId
    : isContextPrompt
      ? contextProductionPromptId
      : scoringProductionPromptByTab[activeTab] ?? null
  const isProductionPromptOpen = Boolean(activeProductionPromptId)

  const getWorkspaceState = useCallback(() => {
    const callPromptState = flowCanvasRef.current?.getState() ?? { nodes: [], edges: [] }
    const contextState =
      contextFlowCanvasRef.current?.getState() ?? contextPromptState
    const latestScoringTabs = (() => {
      if (!isCallPrompt && !isContextPrompt && canvasRef.current) {
        const { nodes, edges } = canvasRef.current.getState()
        return saveScoringPromptTabState(scoringTabs, activeTab, nodes, edges)
      }
      return scoringTabs
    })()
    return { callPromptState, contextState, latestScoringTabs }
  }, [scoringTabs, activeTab, currentScoringTabId, isCallPrompt, isContextPrompt, contextPromptState])

  const handleSave = useCallback(() => {
    setSaveError(null)
    saveCurrentCanvasState()
    const { callPromptState, contextState, latestScoringTabs } = getWorkspaceState()
    const success = saveWorkspace({
      callPrompt: callPromptState,
      contextPrompt: contextState,
      scoringTabs: latestScoringTabs,
      activeTab,
      currentScoringTabId,
    })
    if (!success) {
      setSaveError("Failed to save workspace")
      return
    }
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }, [saveCurrentCanvasState, getWorkspaceState, activeTab, currentScoringTabId])

  const handlePublish = useCallback(async () => {
    if (!activeProductionPromptId || isPublishing)
      return

    setSaveError(null)
    saveCurrentCanvasState()
    const { callPromptState, contextState, latestScoringTabs } = getWorkspaceState()
    saveWorkspace({
      callPrompt: callPromptState,
      contextPrompt: contextState,
      scoringTabs: latestScoringTabs,
      activeTab,
      currentScoringTabId,
    })

    setIsPublishing(true)
    try {
      if (isCallPrompt) {
        const promptStringToSave = flowCanvasRef.current?.getPrompt() ?? ""
        await updatePromptStringById(activeProductionPromptId, promptStringToSave)
      } else if (isContextPrompt) {
        const promptStringToSave = contextFlowCanvasRef.current?.getPrompt() ?? ""
        await updateCandidateContextPrompt(activeProductionPromptId, promptStringToSave)
      } else {
        const activeScoringTab = latestScoringTabs.find((tab) => tab.id === activeTab)
        if (!activeScoringTab) {
          setSaveError("Active scoring tab was not found")
          setIsPublishing(false)
          return
        }
        const criteriaId = scoringProductionCriteriaByTab[activeTab]
        if (!criteriaId) {
          setSaveError("No criteria associated with this scoring tab")
          setIsPublishing(false)
          return
        }
        const promptStringToSave = generateScoringPrompt(activeScoringTab.nodes, activeScoringTab.edges)
        await updateCriteriaScoringPrompt(criteriaId, promptStringToSave)
      }
      setIsPublished(true)
      setTimeout(() => setIsPublished(false), 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update production prompt"
      setSaveError(message)
    } finally {
      setIsPublishing(false)
    }
  }, [activeProductionPromptId, isPublishing, saveCurrentCanvasState, getWorkspaceState, isCallPrompt, isContextPrompt, activeTab, currentScoringTabId, scoringProductionCriteriaByTab])

  const handleClear = useCallback(() => {
    clearWorkspace()
    flowCanvasRef.current?.setState([], [])
    contextFlowCanvasRef.current?.setState([], [])
    setContextPromptState({ nodes: [], edges: [] })
    const freshTab = createScoringPromptTab()
    setScoringTabs([freshTab])
    setCurrentScoringTabId(freshTab.id)
    setActiveTab("call-prompt")
    setConversationMessages([])
    setConversationPrompt("")
    setCallProductionPromptId(null)
    setContextProductionPromptId(null)
    setScoringProductionPromptByTab({})
    setScoringProductionCriteriaByTab({})
    setSaveError(null)
  }, [])

  useEffect(() => {
    const saved = loadWorkspace()
    if (!saved) return
    if (saved.callPrompt.nodes.length > 0) {
      setTimeout(() => {
        flowCanvasRef.current?.setState(saved.callPrompt.nodes, saved.callPrompt.edges)
      }, 100)
    }
    if (saved.contextPrompt.nodes.length > 0) {
      setContextPromptState(saved.contextPrompt)
    }
    if (saved.scoringTabs.length > 0) {
      setScoringTabs(saved.scoringTabs)
      setCurrentScoringTabId(saved.currentScoringTabId || saved.scoringTabs[0].id)
    }
    if (saved.activeTab) setActiveTab(saved.activeTab)
  }, [])

  const handleAddBlock = useCallback(
    (blockType: string) => {
      if (isCallPrompt) flowCanvasRef.current?.addBlock(blockType)
      else if (isContextPrompt) contextFlowCanvasRef.current?.addBlock(blockType)
      else canvasRef.current?.addBlock(blockType)
    },
    [isCallPrompt, isContextPrompt],
  )

  const handleImport = useCallback(() => {
    if (isCallPrompt) flowCanvasRef.current?.openImport()
    else if (isContextPrompt) contextFlowCanvasRef.current?.openImport()
    else canvasRef.current?.openImport()
  }, [isCallPrompt, isContextPrompt])

  const handleViewPrompt = useCallback(() => {
    if (isCallPrompt) flowCanvasRef.current?.viewPrompt()
    else if (isContextPrompt) contextFlowCanvasRef.current?.viewPrompt()
    else canvasRef.current?.viewPrompt()
  }, [isCallPrompt, isContextPrompt])

  const handleOpenContextRun = useCallback(() => {
    setIsContextRunOpen(true)
  }, [])

  const handleRunContextPrompt = useCallback(async () => {
    const prompt = contextFlowCanvasRef.current?.getPrompt() ?? ""
    let resumeJson: unknown
    try {
      resumeJson = JSON.parse(resumeJsonText)
    } catch {
      setContextRunError("Resume JSON is invalid. Check the syntax.")
      return
    }
    const controller = new AbortController()
    contextRunAbortRef.current = controller
    setIsContextRunning(true)
    setContextRunError(null)
    setContextRunResult(null)
    try {
      const { result, error } = await runContextPrompt(
        prompt,
        resumeJson,
        controller.signal,
      )
      if (error) setContextRunError(error)
      else setContextRunResult(result)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setContextRunError((err as Error).message ?? "Unknown error")
      }
    } finally {
      setIsContextRunning(false)
      contextRunAbortRef.current = null
    }
  }, [resumeJsonText])

  const handleStopContextRun = useCallback(() => {
    contextRunAbortRef.current?.abort()
  }, [])

  const handleCreateScoringPrompt = useCallback(
    (nodes: Node<ScoringNodeData>[], edges: Edge[], tabName: string) => {
      saveCurrentCanvasState()
      const newTab = createScoringPromptTab(tabName)
      newTab.nodes = nodes
      newTab.edges = edges
      setScoringTabs((prev) => [...prev, newTab])
      setCurrentScoringTabId(newTab.id)
      setActiveTab(newTab.id)
    },
    [saveCurrentCanvasState],
  )

  const handleWizardComplete = useCallback(
    async (result: WizardResult) => {
      flowCanvasRef.current?.setState(
        result.callPrompt.nodes,
        result.callPrompt.edges,
      )

      const newTabs: ScoringPromptTab[] = []
      for (const scoring of result.scoringPrompts) {
        const tab = createScoringPromptTab(scoring.tabName)
        tab.nodes = scoring.nodes
        tab.edges = scoring.edges
        newTabs.push(tab)
      }

      if (newTabs.length > 0) {
        setScoringTabs(newTabs)
        setCurrentScoringTabId(newTabs[0].id)
      }

      setActiveTab("call-prompt")

      if (!result.persisted)
        return

      const roles = await getJobRolesByOrganization(result.persisted.organizationId)
      setJobRoles(roles)
      setSelectedOrganizationId(result.persisted.organizationId)
      setSelectedJobRoleId(result.persisted.roleId)
    },
    [],
  )

  const handleSelectOrganization = useCallback(async (orgId: string) => {
    setSelectedOrganizationId(orgId)
    setJobRoles([])
    setSelectedJobRoleId(null)
    setPromptReferences([])
    setIsLoadingPromptReferences(false)
    setPromptReferencesError(null)
    setCriteriaByPromptId({})
    setIsLoadingCriteria(false)
    setCriteriaError(null)
    setPromptImportError(null)
    setCriteriaImportError(null)
    setIsLoadingJobRoles(true)
    setJobRolesError(null)
    setIsCreatingJobRole(false)
    try {
      const roles = await getJobRolesByOrganization(orgId)
      setJobRoles(roles)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load job roles"
      setJobRoles([])
      setJobRolesError(message)
    } finally {
      setIsLoadingJobRoles(false)
    }
  }, [])

  const handleSelectJobRole = useCallback(async (roleId: string) => {
    setSelectedJobRoleId(roleId)
    setPromptReferences([])
    setCriteriaByPromptId({})
    setIsLoadingPromptReferences(true)
    setIsLoadingCriteria(true)
    setPromptReferencesError(null)
    setCriteriaError(null)
    setPromptImportError(null)
    setCriteriaImportError(null)

    const matchedRole = jobRoles.find((r) => r.roleId === roleId)
    const contextPromptId = matchedRole?.contextPromptId ?? null

    try {
      const [references, criteria] = await Promise.all([
        getPromptReferencesByRole(roleId),
        getCriteriaByRole(roleId),
      ])
      setPromptReferences(references)
      setCriteriaByPromptId(criteria)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load prompt IDs"
      setPromptReferences([])
      setPromptReferencesError(message)
      setCriteriaByPromptId({})
      setCriteriaError(message)
    } finally {
      setIsLoadingPromptReferences(false)
      setIsLoadingCriteria(false)
    }

    if (contextPromptId) {
      setContextProductionPromptId(contextPromptId)
      try {
        const promptText = await getCandidateContextPrompt(contextPromptId)
        if (promptText) {
          const imported = contextFlowCanvasRef.current?.importPrompt(promptText)
          if (imported) {
            const state = contextFlowCanvasRef.current?.getState()
            if (state) setContextPromptState(state)
          }
        }
      } catch {
        // Context prompt fetch is best-effort; don't block role selection
      }
    } else {
      setContextProductionPromptId(null)
    }
  }, [jobRoles])

  const handleCreateJobRole = useCallback(async (assessmentInstanceName: string) => {
    const orgId = selectedOrganizationId?.trim() ?? ""
    if (!orgId)
      throw new Error("Select an organization before creating a role")

    const trimmedAssessmentName = assessmentInstanceName.trim()
    if (!trimmedAssessmentName)
      throw new Error("Assessment instance name is required")

    setIsCreatingJobRole(true)
    setJobRolesError(null)
    try {
      const createdRole = await createJobRole({
        orgId,
        roleDescription: trimmedAssessmentName,
        assessmentInstanceName: trimmedAssessmentName,
      })

      const roles = await getJobRolesByOrganization(orgId)
      setJobRoles(roles)
      setSelectedJobRoleId(createdRole.roleId)
    } finally {
      setIsCreatingJobRole(false)
    }
  }, [selectedOrganizationId])

  const handleCreateContextPrompt = useCallback(async (roleId: string) => {
    const role = jobRoles.find((r) => r.roleId === roleId)
    if (!role?.phoneCallTaskId)
      throw new Error("No outbound call task found for this role")

    const orgId = selectedOrganizationId?.trim() ?? ""
    if (!orgId)
      throw new Error("No organization selected")

    setIsCreatingContextPrompt(true)
    try {
      await createCandidateContextPrompt({ taskId: role.phoneCallTaskId })
      const roles = await getJobRolesByOrganization(orgId)
      setJobRoles(roles)
    } finally {
      setIsCreatingContextPrompt(false)
    }
  }, [jobRoles, selectedOrganizationId])

  const handleSelectPromptReference = useCallback(async (promptId: string) => {
    setPromptImportError(null)
    setCriteriaImportError(null)
    setSaveError(null)
    setIsLoadingPromptIntoCanvas(true)
    try {
      const promptString = await getPromptStringById(promptId)
      const imported = (await flowCanvasRef.current?.importPrompt(promptString)) ?? false
      if (!imported)
        setPromptImportError("Prompt could not be parsed for the current tab")
      else {
        setActiveTab("call-prompt")
        setCallProductionPromptId(promptId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import prompt"
      setPromptImportError(message)
    } finally {
      setIsLoadingPromptIntoCanvas(false)
    }
  }, [])

  const handleSelectCriteria = useCallback(async (criteriaId: string, promptId: string) => {
    setCriteriaImportError(null)
    setPromptImportError(null)
    setSaveError(null)
    setIsLoadingPromptIntoCanvas(true)
    try {
      const scoringPrompt = await getCriteriaScoringPromptById(criteriaId)
      const imported = (await canvasRef.current?.importPrompt(scoringPrompt)) ?? false
      if (!imported)
        setCriteriaImportError("Scoring prompt could not be parsed")
      else {
        setScoringProductionPromptByTab((prev) => ({
          ...prev,
          [currentScoringTabId]: promptId,
        }))
        setScoringProductionCriteriaByTab((prev) => ({
          ...prev,
          [currentScoringTabId]: criteriaId,
        }))
        setActiveTab(currentScoringTabId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import scoring prompt"
      setCriteriaImportError(message)
    } finally {
      setIsLoadingPromptIntoCanvas(false)
    }
  }, [currentScoringTabId])

  const handleCreateCriteriaNode = useCallback(async (
    promptId: string,
    criteriaName: string,
    minScore: number,
    maxScore: number,
  ) => {
    const roleId = selectedJobRoleId?.trim() ?? ""
    if (!roleId)
      throw new Error("Select a role before creating criteria")

    const trimmedCriteriaName = criteriaName.trim()
    if (!trimmedCriteriaName)
      throw new Error("Criteria name is required")

    if (!Number.isFinite(minScore))
      throw new Error("Min score is required")

    if (!Number.isFinite(maxScore))
      throw new Error("Max score is required")

    if (minScore > maxScore)
      throw new Error("Min score must be less than or equal to max score")

    setIsCreatingCriteriaNode(true)
    setCriteriaError(null)
    setCriteriaImportError(null)
    try {
      await createCriteriaNode({
        roleId,
        promptId,
        criteriaName: trimmedCriteriaName,
        minScore,
        maxScore,
      })
      const criteria = await getCriteriaByRole(roleId)
      setCriteriaByPromptId(criteria)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create criteria node"
      setCriteriaError(message)
      throw error
    } finally {
      setIsCreatingCriteriaNode(false)
    }
  }, [selectedJobRoleId])

  return (
    <SidebarProvider>
      <AppSidebar
        defaultEnvironment={defaultEnvironment}
        activeTab={activeTab}
        scoringTabs={scoringTabs}
        organizations={organizations}
        selectedOrganizationId={selectedOrganizationId}
        jobRoles={jobRoles}
        isLoadingJobRoles={isLoadingJobRoles}
        isCreatingJobRole={isCreatingJobRole}
        jobRolesError={jobRolesError}
        selectedJobRoleId={selectedJobRoleId}
        promptReferences={promptReferences}
        isLoadingPromptReferences={isLoadingPromptReferences}
        promptReferencesError={promptReferencesError}
        criteriaByPromptId={criteriaByPromptId}
        isLoadingCriteria={isLoadingCriteria}
        isCreatingCriteriaNode={isCreatingCriteriaNode}
        criteriaError={criteriaError}
        promptImportError={promptImportError}
        criteriaImportError={criteriaImportError}
        editingTabId={editingTabId}
        editingName={editingName}
        onSwitchTab={handleSwitchTab}
        onAddScoringTab={handleAddScoringTab}
        onDeleteScoringTab={handleDeleteScoringTab}
        onStartRename={handleStartRename}
        onFinishRename={handleFinishRename}
        onEditingNameChange={setEditingName}
        onRenameKeyDown={handleRenameKeyDown}
        onReorderScoringTabs={handleReorderScoringTabs}
        onSelectOrganization={handleSelectOrganization}
        onCreateJobRole={handleCreateJobRole}
        onSelectJobRole={handleSelectJobRole}
        onSelectPromptReference={handleSelectPromptReference}
        onSelectCriteria={handleSelectCriteria}
        onCreateCriteriaNode={handleCreateCriteriaNode}
        onCreateContextPrompt={handleCreateContextPrompt}
        isCreatingContextPrompt={isCreatingContextPrompt}
      />
      <SidebarInset>
        <header className="flex h-10 items-center gap-2 px-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium truncate">
            {isCallPrompt
              ? "Call Prompt"
              : isContextPrompt
                ? "Context Prompt"
                : scoringTabToRender?.name ?? "Scoring Prompt"}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <AddNodeToolbar
            onAddBlock={handleAddBlock}
            blockTypes={
              isCallPrompt
                ? undefined
                : isContextPrompt
                  ? ALL_CONTEXT_BLOCK_TYPES
                  : ALL_SCORING_BLOCK_TYPES
            }
          />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Trash2 className="size-4" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all nodes, edges, and scoring tabs from both canvases and clear any saved data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear}>
                    Clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              className="gap-2"
            >
              {isSaved ? <Check className="size-4" /> : <Save className="size-4" />}
              {isSaved ? "Saved!" : "Save"}
            </Button>
            {isProductionPromptOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublish}
                disabled={isPublishing}
                className="gap-2"
              >
                {isPublished ? <Check className="size-4" /> : <UploadCloud className="size-4" />}
                {isPublishing ? "Publishing..." : isPublished ? "Published!" : "Publish"}
              </Button>
            )}
            {saveError && (
              <span className="text-xs text-destructive">{saveError}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsWizardOpen(true)} className="gap-2">
              <Wand2 className="size-4" />
              Wizard
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport} className="gap-2">
              <Upload className="size-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleViewPrompt} className="gap-2">
              <Play className="size-4" />
              View prompt
            </Button>
            {isCallPrompt ? (
              <Button variant="outline" size="sm" onClick={handleOpenConversation} className="gap-2">
                <MessageSquare className="size-4" />
                Run Conversation
              </Button>
            ) : isContextPrompt ? (
              <Button variant="outline" size="sm" onClick={handleOpenContextRun} className="gap-2">
                <PlayCircle className="size-4" />
                Run context prompt
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleOpenScoringResults} className="gap-2">
                <BarChart3 className="size-4" />
                Score Conversation
              </Button>
            )}
          </div>
        </header>
        <div className="relative flex-1">
          <div className={isCallPrompt ? "" : "hidden"}>
            <FlowCanvas ref={flowCanvasRef} onCreateScoringPrompt={handleCreateScoringPrompt} />
          </div>
          <div className={isContextPrompt ? "" : "hidden"}>
            <ContextFlowCanvas
              ref={contextFlowCanvasRef}
              initialNodes={contextPromptState.nodes}
              initialEdges={contextPromptState.edges}
            />
          </div>
          <div className={isCallPrompt || isContextPrompt ? "hidden" : ""}>
            <ScoringFlowCanvas
              key={scoringTabToRender.id}
              ref={canvasRef}
              initialNodes={scoringTabToRender.nodes}
              initialEdges={scoringTabToRender.edges}
            />
          </div>
          {isLoadingPromptIntoCanvas && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading prompt into canvas…</p>
            </div>
          )}
        </div>

        <ConversationPanel
          isOpen={isConversationOpen}
          onOpenChange={setIsConversationOpen}
          callPrompt={conversationPrompt}
          contextResult={contextRunResult}
          onMessagesChange={setConversationMessages}
        />

        <ScoringResultsPanel
          isOpen={isScoringResultsOpen}
          onOpenChange={setIsScoringResultsOpen}
          scoringTabs={scoringTabs}
          activeTabId={activeTab}
          conversationMessages={conversationMessages}
          selectedJobRoleName={
            selectedJobRoleId
              ? (jobRoles.find((r) => r.roleId === selectedJobRoleId)?.roleDescription ?? null)
              : null
          }
          onLoadAllForRole={
            selectedJobRoleId && Object.keys(criteriaByPromptId).length > 0
              ? handleLoadAllRoleScoringPrompts
              : undefined
          }
          isLoadingAllForRole={isLoadingAllRolePrompts}
        />

        <PromptWizard
          isOpen={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={handleWizardComplete}
          organizations={organizations}
          defaultOrganizationId={selectedOrganizationId}
        />

        <Sheet open={isContextRunOpen} onOpenChange={setIsContextRunOpen}>
          <SheetContent className="flex flex-col sm:max-w-2xl">
            <SheetHeader className="shrink-0">
              <SheetTitle>Run context prompt</SheetTitle>
              <SheetDescription>
                Paste or edit the parsed resume JSON below. The context prompt from your canvas will be run with this resume. Ensure an &quot;Input Source&quot; block contains &quot;Here is the Resume :&quot; so the resume is injected correctly.
              </SheetDescription>
            </SheetHeader>
            <div className="flex shrink-0 gap-2 px-1">
              {isContextRunning ? (
                <Button variant="outline" size="sm" onClick={handleStopContextRun} className="gap-2">
                  <Square className="size-4" />
                  Stop
                </Button>
              ) : (
                <Button size="sm" onClick={handleRunContextPrompt} className="gap-2">
                  <PlayCircle className="size-4" />
                  Run
                </Button>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
              <div className="flex flex-col gap-2">
                <label htmlFor="context-resume-json" className="text-sm font-medium text-foreground">
                  Resume JSON
                </label>
                <Textarea
                  id="context-resume-json"
                  value={resumeJsonText}
                  onChange={(e) => setResumeJsonText(e.target.value)}
                  placeholder="Paste parsed resume JSON..."
                  className="min-h-[200px] max-h-[300px] overflow-y-auto font-mono text-sm"
                />
              </div>
              {(contextRunResult !== null || contextRunError !== null) && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {contextRunError ? "Error" : "Result"}
                  </span>
                  <div className="min-h-[120px] max-h-[300px] overflow-y-auto rounded-md border bg-muted p-4">
                    <pre className="whitespace-pre-wrap wrap-break-word text-sm text-foreground">
                      {contextRunError ?? contextRunResult ?? ""}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </SidebarInset>
    </SidebarProvider>
  )
}

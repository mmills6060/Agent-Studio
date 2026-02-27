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
import type { ContextNodeData } from "@/components/handlers/context-flow-canvas-handlers"
import { Play, Upload, MessageSquare, BarChart3, Save, Check, Trash2, Wand2, PlayCircle, Square } from "lucide-react"
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

const DEFAULT_RESUME_JSON_STRING = JSON.stringify(DEFAULT_RESUME_JSON, null, 2)

const firstScoringTab = createScoringPromptTab()

export default function PromptWorkspace() {
  const [activeTab, setActiveTab] = useState<string>("call-prompt")
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

  const [isSaved, setIsSaved] = useState(false)

  const handleSave = useCallback(() => {
    saveCurrentCanvasState()
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
    const success = saveWorkspace({
      callPrompt: callPromptState,
      contextPrompt: contextState,
      scoringTabs: latestScoringTabs,
      activeTab,
      currentScoringTabId,
    })
    if (success) {
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }, [saveCurrentCanvasState, scoringTabs, activeTab, currentScoringTabId, isCallPrompt, isContextPrompt, contextPromptState])

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
    (result: WizardResult) => {
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
    },
    [],
  )

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        scoringTabs={scoringTabs}
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
            <Button variant="outline" size="sm" onClick={handleSave} className="gap-2">
              {isSaved ? <Check className="size-4" /> : <Save className="size-4" />}
              {isSaved ? "Saved!" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsWizardOpen(true)} className="gap-2">
              <Wand2 className="size-4" />
              Wizard
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport} className="gap-2">
              <Upload className="size-4" />
              Import
            </Button>
            <Button size="sm" onClick={handleViewPrompt} className="gap-2">
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
        </div>

        <ConversationPanel
          isOpen={isConversationOpen}
          onOpenChange={setIsConversationOpen}
          callPrompt={conversationPrompt}
          onMessagesChange={setConversationMessages}
        />

        <ScoringResultsPanel
          isOpen={isScoringResultsOpen}
          onOpenChange={setIsScoringResultsOpen}
          scoringTabs={scoringTabs}
          activeTabId={activeTab}
          conversationMessages={conversationMessages}
        />

        <PromptWizard
          isOpen={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={handleWizardComplete}
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

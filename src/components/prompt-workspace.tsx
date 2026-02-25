"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Node, Edge } from "@xyflow/react"
import FlowCanvas from "@/components/flow-canvas"
import type { FlowCanvasRef } from "@/components/flow-canvas"
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
import { Play, Upload, MessageSquare, BarChart3, Save, Check, Trash2 } from "lucide-react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import AddNodeToolbar from "@/components/add-node-toolbar"
import AppSidebar from "@/components/app-sidebar"
import { ALL_SCORING_BLOCK_TYPES } from "@/lib/scoring-block-types"
import { saveWorkspace, loadWorkspace, clearWorkspace } from "@/components/handlers/workspace-save-handlers"
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
  const canvasRef = useRef<ScoringFlowCanvasRef>(null)
  const flowCanvasRef = useRef<FlowCanvasRef>(null)

  const isCallPrompt = activeTab === "call-prompt"
  const scoringTabToRender = scoringTabs.find((t) => t.id === currentScoringTabId) ?? scoringTabs[0]

  const saveCurrentCanvasState = useCallback(() => {
    if (!canvasRef.current || isCallPrompt) return
    const { nodes, edges } = canvasRef.current.getState()
    setScoringTabs((prev) => saveScoringPromptTabState(prev, activeTab, nodes, edges))
  }, [activeTab, isCallPrompt])

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return
      saveCurrentCanvasState()
      if (tabId !== "call-prompt") setCurrentScoringTabId(tabId)
      setActiveTab(tabId)
    },
    [activeTab, saveCurrentCanvasState],
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
    const latestScoringTabs = (() => {
      if (!isCallPrompt && canvasRef.current) {
        const { nodes, edges } = canvasRef.current.getState()
        return saveScoringPromptTabState(scoringTabs, activeTab, nodes, edges)
      }
      return scoringTabs
    })()
    const success = saveWorkspace({
      callPrompt: callPromptState,
      scoringTabs: latestScoringTabs,
      activeTab,
      currentScoringTabId,
    })
    if (success) {
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }, [saveCurrentCanvasState, scoringTabs, activeTab, currentScoringTabId, isCallPrompt])

  const handleClear = useCallback(() => {
    clearWorkspace()
    flowCanvasRef.current?.setState([], [])
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
    if (saved.scoringTabs.length > 0) {
      setScoringTabs(saved.scoringTabs)
      setCurrentScoringTabId(saved.currentScoringTabId || saved.scoringTabs[0].id)
    }
    if (saved.activeTab) setActiveTab(saved.activeTab)
  }, [])

  const handleAddBlock = useCallback(
    (blockType: string) => {
      if (isCallPrompt) flowCanvasRef.current?.addBlock(blockType)
      else canvasRef.current?.addBlock(blockType)
    },
    [isCallPrompt],
  )

  const handleImport = useCallback(() => {
    if (isCallPrompt) flowCanvasRef.current?.openImport()
    else canvasRef.current?.openImport()
  }, [isCallPrompt])

  const handleViewPrompt = useCallback(() => {
    if (isCallPrompt) flowCanvasRef.current?.viewPrompt()
    else canvasRef.current?.viewPrompt()
  }, [isCallPrompt])

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
            {isCallPrompt ? "Call Prompt" : scoringTabToRender?.name ?? "Scoring Prompt"}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <AddNodeToolbar
            onAddBlock={handleAddBlock}
            blockTypes={isCallPrompt ? undefined : ALL_SCORING_BLOCK_TYPES}
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
          <div className={isCallPrompt ? "hidden" : ""}>
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
      </SidebarInset>
    </SidebarProvider>
  )
}

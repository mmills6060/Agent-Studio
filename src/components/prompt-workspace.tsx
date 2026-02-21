"use client"

import { useCallback, useRef, useState } from "react"
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
import { Play, Upload, MessageSquare, BarChart3 } from "lucide-react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import AddNodeToolbar from "@/components/add-node-toolbar"
import AppSidebar from "@/components/app-sidebar"
import { ALL_SCORING_BLOCK_TYPES } from "@/lib/scoring-block-types"

const firstScoringTab = createScoringPromptTab()

export default function PromptWorkspace() {
  const [activeTab, setActiveTab] = useState<string>("call-prompt")
  const [scoringTabs, setScoringTabs] = useState<ScoringPromptTab[]>([firstScoringTab])
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isConversationOpen, setIsConversationOpen] = useState(false)
  const [conversationPrompt, setConversationPrompt] = useState("")
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [isScoringResultsOpen, setIsScoringResultsOpen] = useState(false)
  const canvasRef = useRef<ScoringFlowCanvasRef>(null)
  const flowCanvasRef = useRef<FlowCanvasRef>(null)

  const isCallPrompt = activeTab === "call-prompt"
  const activeScoringTab = scoringTabs.find((t) => t.id === activeTab)

  const saveCurrentCanvasState = useCallback(() => {
    if (!canvasRef.current || isCallPrompt) return
    const { nodes, edges } = canvasRef.current.getState()
    setScoringTabs((prev) => saveScoringPromptTabState(prev, activeTab, nodes, edges))
  }, [activeTab, isCallPrompt])

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return
      saveCurrentCanvasState()
      setActiveTab(tabId)
    },
    [activeTab, saveCurrentCanvasState],
  )

  const handleAddScoringTab = useCallback(() => {
    saveCurrentCanvasState()
    const newTab = createScoringPromptTab()
    setScoringTabs((prev) => [...prev, newTab])
    setActiveTab(newTab.id)
  }, [saveCurrentCanvasState])

  const handleDeleteScoringTab = useCallback(
    (tabId: string) => {
      if (scoringTabs.length <= 1) return
      saveCurrentCanvasState()
      const updated = deleteScoringPromptTab(scoringTabs, tabId)
      setScoringTabs(updated)
      if (activeTab === tabId) {
        const deletedIndex = scoringTabs.findIndex((t) => t.id === tabId)
        const nextTab = updated[Math.min(deletedIndex, updated.length - 1)]
        setActiveTab(nextTab.id)
      }
    },
    [scoringTabs, activeTab, saveCurrentCanvasState],
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

  const handleOpenConversation = useCallback(() => {
    const prompt = flowCanvasRef.current?.getPrompt() ?? ""
    setConversationPrompt(prompt)
    setIsConversationOpen(true)
  }, [])

  const handleOpenScoringResults = useCallback(() => {
    saveCurrentCanvasState()
    setIsScoringResultsOpen(true)
  }, [saveCurrentCanvasState])

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
      />
      <SidebarInset>
        <header className="flex h-10 items-center gap-2 px-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <AddNodeToolbar
            onAddBlock={handleAddBlock}
            blockTypes={isCallPrompt ? undefined : ALL_SCORING_BLOCK_TYPES}
          />
          <div className="ml-auto flex items-center gap-2">
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
          {isCallPrompt && (
            <FlowCanvas ref={flowCanvasRef} />
          )}
          {activeScoringTab && (
            <ScoringFlowCanvas
              key={activeScoringTab.id}
              ref={canvasRef}
              initialNodes={activeScoringTab.nodes}
              initialEdges={activeScoringTab.edges}
            />
          )}
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

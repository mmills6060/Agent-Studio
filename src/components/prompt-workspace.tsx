"use client"

import { useCallback, useRef, useState } from "react"
import { Phone, ClipboardCheck, Plus, X, MessageSquare, BarChart3 } from "lucide-react"
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

  return (
    <div className="fixed inset-0">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center">
        <div className="pointer-events-auto flex max-w-[90vw] items-center gap-1 overflow-x-auto rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <button
            onClick={() => handleSwitchTab("call-prompt")}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isCallPrompt
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Phone className="size-4" />
            Call Prompt
          </button>

          <div className="mx-1 h-5 w-px bg-border" />

          {scoringTabs.map((tab) => {
            const isActive = tab.id === activeTab

            return (
              <div
                key={tab.id}
                className={`group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <ClipboardCheck className="size-4 shrink-0" />
                {editingTabId === tab.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    className="w-28 rounded border bg-background px-1 py-0.5 text-sm text-foreground outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => handleSwitchTab(tab.id)}
                    onDoubleClick={() => handleStartRename(tab.id)}
                    className="cursor-pointer truncate"
                  >
                    {tab.name}
                  </button>
                )}
                {scoringTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteScoringTab(tab.id)
                    }}
                    className={`shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                      isActive
                        ? "hover:bg-primary-foreground/20"
                        : "hover:bg-muted-foreground/20"
                    }`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )
          })}

          <button
            onClick={handleAddScoringTab}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Add scoring prompt"
          >
            <Plus className="size-4" />
          </button>

          {isCallPrompt && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <button
                onClick={handleOpenConversation}
                className="flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="size-4" />
                Run Conversation
              </button>
            </>
          )}

          <div className="mx-1 h-5 w-px bg-border" />
          <button
            onClick={handleOpenScoringResults}
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BarChart3 className="size-4" />
            Score Conversation
          </button>
        </div>
      </div>

      <div className="relative size-full">
        {isCallPrompt && <FlowCanvas ref={flowCanvasRef} />}
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
    </div>
  )
}

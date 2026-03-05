"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Play,
  PlayCircle,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  formatConversationTranscript,
  createEmptyResults,
  runSingleScoring,
  type ScoringResult,
  type ScoringTab,
} from "@/components/handlers/scoring-runner-handlers"
import type { ConversationMessage } from "@/components/handlers/conversation-handlers"

interface ScoringResultsPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  scoringTabs: ScoringTab[]
  activeTabId: string
  conversationMessages: ConversationMessage[]
  selectedJobRoleName?: string | null
  onLoadAllForRole?: () => Promise<void>
  isLoadingAllForRole?: boolean
}

export default function ScoringResultsPanel({
  isOpen,
  onOpenChange,
  scoringTabs,
  activeTabId,
  conversationMessages,
  selectedJobRoleName,
  onLoadAllForRole,
  isLoadingAllForRole,
}: ScoringResultsPanelProps) {
  const [transcript, setTranscript] = useState("")
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const [results, setResults] = useState<ScoringResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const hasPrefilledRef = useRef(false)

  useEffect(() => {
    if (isOpen && conversationMessages.length > 0 && !hasPrefilledRef.current) {
      setTranscript(formatConversationTranscript(conversationMessages))
      hasPrefilledRef.current = true
    }
    if (!isOpen) hasPrefilledRef.current = false
  }, [isOpen, conversationMessages])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setIsRunning(false)
  }, [])

  const runScoring = useCallback(
    async (tabs: ScoringTab[]) => {
      const conversationText = transcript.trim()
      if (!conversationText) return

      const controller = new AbortController()
      abortRef.current = controller

      setIsRunning(true)
      setResults(createEmptyResults(tabs))

      for (const tab of tabs) {
        if (controller.signal.aborted) break

        try {
          const result = await runSingleScoring(
            tab,
            conversationText,
            controller.signal,
          )
          setResults((prev) =>
            prev.map((r) => (r.tabId === tab.id ? result : r)),
          )
        } catch (err) {
          if ((err as Error).name === "AbortError") break
        }
      }

      setIsRunning(false)
      abortRef.current = null
    },
    [transcript],
  )

  const handleRunCurrent = useCallback(() => {
    const currentTab = scoringTabs.find((t) => t.id === activeTabId)
    if (!currentTab) return
    runScoring([currentTab])
  }, [scoringTabs, activeTabId, runScoring])

  const handleRunAll = useCallback(() => {
    runScoring(scoringTabs)
  }, [scoringTabs, runScoring])

  const activeTabName =
    scoringTabs.find((t) => t.id === activeTabId)?.name ?? "Current"
  const hasTranscript = transcript.trim().length > 0

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Score Conversation</SheetTitle>
          <SheetDescription>
            Run scoring prompts against a conversation transcript using GPT-4o.
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 flex-col gap-3 px-4">
          <button
            onClick={() => setIsTranscriptOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {isTranscriptOpen ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            Conversation Transcript
            {hasTranscript && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                ready
              </span>
            )}
          </button>
          {isTranscriptOpen && (
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={isRunning}
              placeholder="Paste a conversation transcript here, or run a conversation first to auto-fill..."
              className="min-h-[160px] max-h-[40vh] overflow-y-auto font-mono text-sm resize-none"
            />
          )}

          {selectedJobRoleName && onLoadAllForRole && (
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
              <span className="flex-1 text-xs text-muted-foreground">
                Load all scoring prompts for <span className="font-medium text-foreground">{selectedJobRoleName}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadAllForRole}
                disabled={isLoadingAllForRole || isRunning}
                className="gap-2 shrink-0"
              >
                {isLoadingAllForRole ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {isLoadingAllForRole ? "Loading…" : "Load All"}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                className="gap-2"
              >
                <Square className="size-4" />
                Stop
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleRunCurrent}
                  disabled={!hasTranscript || activeTabId === "call-prompt"}
                  className="gap-2"
                >
                  <Play className="size-4" />
                  Run &quot;{activeTabName}&quot;
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunAll}
                  disabled={!hasTranscript || scoringTabs.length === 0}
                  className="gap-2"
                >
                  <PlayCircle className="size-4" />
                  Run All ({scoringTabs.length})
                </Button>
              </>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div className="min-h-0 flex-1 px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-3">
                {results.map((r) => (
                  <ResultCard key={r.tabId} result={r} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {results.length === 0 && (
          <div className="flex flex-1 items-center justify-center px-4 pb-4">
            <p className="text-center text-sm text-muted-foreground">
              {hasTranscript
                ? "Click a Run button above to score the conversation."
                : "Add a conversation transcript above, then run scoring."}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ResultCard({ result }: { result: ScoringResult }) {
  if (result.isLoading)
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ClipboardCheck className="size-4 text-primary" />
          {result.tabName}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Scoring in progress...
        </div>
      </div>
    )

  if (result.error)
    return (
      <div className="rounded-lg border border-destructive/50 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ClipboardCheck className="size-4 text-destructive" />
          {result.tabName}
        </div>
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {result.error}
        </div>
      </div>
    )

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ClipboardCheck className="size-4 text-primary" />
        {result.tabName}
      </div>
      <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground">
        {result.result}
      </div>
    </div>
  )
}

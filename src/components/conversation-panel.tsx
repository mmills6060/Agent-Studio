"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Square, ChevronDown, ChevronUp, Phone, User, Loader2, Copy, Check, Code, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  createInitialState,
  buildCandidateSystemPrompt,
  formatHistoryForAgent,
  fetchAgentResponse,
  DEFAULT_CANDIDATE_PROMPT,
  type ConversationMessage,
  type ConversationState,
} from "@/components/handlers/conversation-handlers"

interface ConversationPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  callPrompt: string
  contextResult?: string | null
  onMessagesChange?: (messages: ConversationMessage[]) => void
}

export default function ConversationPanel({
  isOpen,
  onOpenChange,
  callPrompt,
  contextResult,
  onMessagesChange,
}: ConversationPanelProps) {
  const [state, setState] = useState<ConversationState>(createInitialState(100))
  const [candidatePrompt, setCandidatePrompt] = useState(DEFAULT_CANDIDATE_PROMPT)
  const [maxTurns, setMaxTurns] = useState(100)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<"interviewer" | "candidate" | null>(null)
  const [viewMode, setViewMode] = useState<"chat" | "json">("chat")
  const [isCopied, setIsCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      const viewport = scrollRef.current.querySelector("[data-slot='scroll-area-viewport']")
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [state.messages, scrollToBottom])

  useEffect(() => {
    onMessagesChange?.(state.messages)
  }, [state.messages, onMessagesChange])

  const runConversation = useCallback(async () => {
    if (!callPrompt.trim()) {
      setState((s) => ({ ...s, error: "No call prompt found. Add blocks to the canvas first." }))
      return
    }

    const effectivePrompt = contextResult?.trim()
      ? `${callPrompt}\n\n--- Context Prompt Output ---\n${contextResult}`
      : callPrompt

    const controller = new AbortController()
    abortRef.current = controller
    const candidateSystemPrompt = buildCandidateSystemPrompt(candidatePrompt)

    setState((s) => ({
      ...s,
      messages: [],
      isRunning: true,
      currentTurn: 0,
      maxTurns: maxTurns,
      error: null,
    }))

    const messages: ConversationMessage[] = []

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        if (controller.signal.aborted) break

        setActiveAgent("interviewer")
        const interviewerHistory = formatHistoryForAgent(messages, "interviewer")
        const interviewerMsg = await fetchAgentResponse(
          effectivePrompt,
          interviewerHistory,
          "interviewer",
          controller.signal,
        )

        const interviewerEntry: ConversationMessage = { role: "interviewer", content: interviewerMsg }
        messages.push(interviewerEntry)
        setState((s) => ({
          ...s,
          messages: [...messages],
          currentTurn: turn + 1,
        }))

        if (controller.signal.aborted) break

        setActiveAgent("candidate")
        const candidateHistory = formatHistoryForAgent(messages, "candidate")
        const candidateMsg = await fetchAgentResponse(
          candidateSystemPrompt,
          candidateHistory,
          "candidate",
          controller.signal,
        )

        const candidateEntry: ConversationMessage = { role: "candidate", content: candidateMsg }
        messages.push(candidateEntry)
        setState((s) => ({
          ...s,
          messages: [...messages],
          currentTurn: turn + 1,
        }))
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({
          ...s,
          error: (err as Error).message ?? "Unknown error",
        }))
      }
    } finally {
      setState((s) => ({ ...s, isRunning: false }))
      setActiveAgent(null)
      abortRef.current = null
    }
  }, [callPrompt, contextResult, candidatePrompt, maxTurns])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setState((s) => ({ ...s, isRunning: false }))
    setActiveAgent(null)
  }, [])

  const handleCopyJson = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(state.messages, null, 2))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [state.messages])

  const hasMessages = state.messages.length > 0

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>AI Conversation</SheetTitle>
          <SheetDescription>
            Two AI agents converse — one as the interviewer (using your call prompt) and one as the candidate.
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 flex-col gap-3 px-4">
          <div className="flex items-center gap-3">
            {state.isRunning ? (
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
              <Button
                size="sm"
                onClick={runConversation}
                disabled={!callPrompt.trim()}
                className="gap-2"
              >
                <Play className="size-4" />
                Start
              </Button>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="max-turns" className="text-sm text-muted-foreground whitespace-nowrap">
                Max turns
              </label>
              <Input
                id="max-turns"
                type="number"
                min={1}
                max={200}
                value={maxTurns}
                onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 100)}
                disabled={state.isRunning}
                className="w-20"
              />
            </div>
            {state.currentTurn > 0 && (
              <span className="text-sm text-muted-foreground">
                Turn {state.currentTurn}/{state.maxTurns}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setViewMode((v) => (v === "chat" ? "json" : "chat"))}
                disabled={!hasMessages}
                title={viewMode === "chat" ? "View as JSON" : "View as chat"}
              >
                {viewMode === "chat" ? <Code className="size-4" /> : <MessageSquare className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleCopyJson}
                disabled={!hasMessages}
                title="Copy conversation as JSON"
              >
                {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          <button
            onClick={() => setIsConfigOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {isConfigOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            Candidate System Prompt
          </button>
          {isConfigOpen && (
            <Textarea
              value={candidatePrompt}
              onChange={(e) => setCandidatePrompt(e.target.value)}
              disabled={state.isRunning}
              placeholder="Enter the candidate agent's system prompt..."
              className="min-h-[120px] text-sm"
            />
          )}
        </div>

        {state.error && (
          <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="min-h-0 flex-1 px-4 pb-4">
          <ScrollArea ref={scrollRef} className="h-full rounded-md border">
            {viewMode === "json" && hasMessages ? (
              <pre className="whitespace-pre-wrap p-4 font-mono text-sm text-foreground">
                {JSON.stringify(state.messages, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col gap-4 p-4">
                {!hasMessages && !state.isRunning && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Click Start to begin the conversation between the interviewer and candidate agents.
                  </p>
                )}
                {state.messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {activeAgent && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {activeAgent === "interviewer" ? "Interviewer" : "Candidate"} is responding...
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isInterviewer = message.role === "interviewer"

  return (
    <div className={`flex gap-3 ${isInterviewer ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isInterviewer
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isInterviewer ? <Phone className="size-4" /> : <User className="size-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isInterviewer
            ? "bg-primary/10 text-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {isInterviewer ? "Interviewer" : "Candidate"}
        </p>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}

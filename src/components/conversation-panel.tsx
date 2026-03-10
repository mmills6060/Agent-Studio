"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Play, Square, ChevronDown, ChevronUp, Phone, User, Loader2, Copy, Check, Code, MessageSquare, Settings2, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createInitialState,
  runAiVsAiConversation,
  fetchInterviewerReply,
  createConversationMessage,
  buildCandidateMessage,
  DEFAULT_CANDIDATE_PROMPT,
  type ConversationMessage,
  type ConversationState,
  type ConversationMode,
} from "@/components/handlers/conversation-handlers"
import {
  buildVoiceAgentConfig,
  createMessageAudioKey,
  getVoiceOptionById,
  requestTtsAudio,
  VOICE_AGENT_OPTIONS,
  type VoiceAgentConfig,
} from "@/components/handlers/conversation-tts-handlers"

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
  const [mode, setMode] = useState<ConversationMode>("ai-vs-ai")
  const [candidatePrompt, setCandidatePrompt] = useState(DEFAULT_CANDIDATE_PROMPT)
  const [maxTurns, setMaxTurns] = useState(100)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<"interviewer" | "candidate" | null>(null)
  const [viewMode, setViewMode] = useState<"chat" | "json">("chat")
  const [isCopied, setIsCopied] = useState(false)
  const [candidateInput, setCandidateInput] = useState("")
  const [isVoiceAgentModalOpen, setIsVoiceAgentModalOpen] = useState(false)
  const [voiceAgentConfig, setVoiceAgentConfig] = useState<VoiceAgentConfig>(buildVoiceAgentConfig())
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [loadingAudioMessageId, setLoadingAudioMessageId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const ttsAbortRef = useRef<AbortController | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioCacheRef = useRef<Map<string, string>>(new Map())
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

  useEffect(() => {
    setCandidateInput("")
    if (mode === "human-candidate") setIsConfigOpen(false)
  }, [mode])

  const stopAudioPlayback = useCallback(() => {
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    setLoadingAudioMessageId(null)

    if (!currentAudioRef.current) {
      setPlayingMessageId(null)
      return
    }

    currentAudioRef.current.pause()
    currentAudioRef.current.currentTime = 0
    currentAudioRef.current = null
    setPlayingMessageId(null)
  }, [])

  useEffect(() => {
    return () => {
      stopAudioPlayback()
      for (const objectUrl of audioCacheRef.current.values())
        URL.revokeObjectURL(objectUrl)
      audioCacheRef.current.clear()
    }
  }, [stopAudioPlayback])

  const runConversation = useCallback(async (selectedMode: ConversationMode) => {
    if (!callPrompt.trim()) {
      setState((s) => ({ ...s, error: "No call prompt found. Add blocks to the canvas first." }))
      return
    }

    setMode(selectedMode)
    const controller = new AbortController()
    abortRef.current = controller
    let shouldKeepSessionRunning = false
    setCandidateInput("")

    setState((s) => ({
      ...s,
      messages: [],
      isRunning: true,
      currentTurn: 0,
      maxTurns: maxTurns,
      error: null,
    }))

    try {
      switch (selectedMode) {
        case "ai-vs-ai":
          await runAiVsAiConversation({
            callPrompt,
            contextResult,
            candidatePrompt,
            maxTurns,
            signal: controller.signal,
            onSetActiveAgent: setActiveAgent,
            onTurnUpdate: (messages, turn) => {
              setState((s) => ({
                ...s,
                messages,
                currentTurn: turn,
              }))
            },
          })
          break
        case "human-candidate": {
          setActiveAgent("interviewer")
          const interviewerMsg = await fetchInterviewerReply(
            callPrompt,
            contextResult,
            [],
            controller.signal,
          )
          const interviewerEntry = createConversationMessage("interviewer", interviewerMsg)
          setState((s) => ({
            ...s,
            messages: [interviewerEntry],
            currentTurn: 0,
          }))
          shouldKeepSessionRunning = true
          break
        }
        default: {
          const unsupportedMode: never = selectedMode
          throw new Error(`Unsupported conversation mode: ${unsupportedMode}`)
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({
          ...s,
          error: (err as Error).message ?? "Unknown error",
        }))
      }
    } finally {
      setActiveAgent(null)
      if (shouldKeepSessionRunning && !controller.signal.aborted) return
      setState((s) => ({ ...s, isRunning: false }))
      abortRef.current = null
    }
  }, [callPrompt, contextResult, candidatePrompt, maxTurns])

  const handleSubmitCandidateMessage = useCallback(async () => {
    if (mode !== "human-candidate") return
    if (!state.isRunning) return

    const controller = abortRef.current
    if (!controller) return

    const messageContent = candidateInput.trim()
    if (!messageContent) return

    const candidateEntry = buildCandidateMessage(messageContent)
    const updatedMessages = [...state.messages, candidateEntry]
    const completedTurn = state.currentTurn + 1

    setCandidateInput("")
    setState((s) => ({
      ...s,
      messages: updatedMessages,
      currentTurn: completedTurn,
      error: null,
    }))

    if (completedTurn >= maxTurns) {
      setState((s) => ({ ...s, isRunning: false }))
      abortRef.current = null
      return
    }

    try {
      setActiveAgent("interviewer")
      const interviewerMsg = await fetchInterviewerReply(
        callPrompt,
        contextResult,
        updatedMessages,
        controller.signal,
      )
      const interviewerEntry = createConversationMessage("interviewer", interviewerMsg)
      setState((s) => ({
        ...s,
        messages: [...updatedMessages, interviewerEntry],
      }))
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({
          ...s,
          error: (err as Error).message ?? "Unknown error",
          isRunning: false,
        }))
        abortRef.current = null
      }
    } finally {
      setActiveAgent(null)
    }
  }, [mode, state.isRunning, state.currentTurn, state.messages, candidateInput, maxTurns, callPrompt, contextResult])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    stopAudioPlayback()
    setState((s) => ({ ...s, isRunning: false }))
    setActiveAgent(null)
  }, [stopAudioPlayback])

  const handleCopyJson = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(state.messages, null, 2))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [state.messages])

  const handleCandidateInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return
      event.preventDefault()
      void handleSubmitCandidateMessage()
    },
    [handleSubmitCandidateMessage],
  )

  const hasMessages = state.messages.length > 0

  const handleToggleMessageAudio = useCallback(async (message: ConversationMessage) => {
    if (playingMessageId === message.id) {
      stopAudioPlayback()
      return
    }

    stopAudioPlayback()
    setState((s) => ({ ...s, error: null }))

    const audioCacheKey = createMessageAudioKey(message.id, voiceAgentConfig)
    const cachedAudioUrl = audioCacheRef.current.get(audioCacheKey)
    if (cachedAudioUrl) {
      const cachedAudio = new Audio(cachedAudioUrl)
      currentAudioRef.current = cachedAudio
      setPlayingMessageId(message.id)
      cachedAudio.onended = () => {
        if (currentAudioRef.current === cachedAudio) {
          currentAudioRef.current = null
          setPlayingMessageId(null)
        }
      }
      cachedAudio.onerror = () => {
        if (currentAudioRef.current === cachedAudio) {
          currentAudioRef.current = null
          setPlayingMessageId(null)
          setState((s) => ({ ...s, error: "Audio playback failed for this utterance." }))
        }
      }
      try {
        await cachedAudio.play()
      } catch {
        if (currentAudioRef.current === cachedAudio) {
          currentAudioRef.current = null
          setPlayingMessageId(null)
        }
      }
      return
    }

    const ttsController = new AbortController()
    ttsAbortRef.current = ttsController
    setLoadingAudioMessageId(message.id)

    try {
      const audioBlob = await requestTtsAudio(
        {
          text: message.content,
          provider: voiceAgentConfig.provider,
          voiceId: voiceAgentConfig.voiceId,
          speakingRate: voiceAgentConfig.speakingRate,
        },
        ttsController.signal,
      )

      const audioUrl = URL.createObjectURL(audioBlob)
      audioCacheRef.current.set(audioCacheKey, audioUrl)
      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio
      setPlayingMessageId(message.id)

      audio.onended = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
          setPlayingMessageId(null)
        }
      }

      audio.onerror = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null
          setPlayingMessageId(null)
          setState((s) => ({ ...s, error: "Audio playback failed for this utterance." }))
        }
      }

      await audio.play()
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setState((s) => ({
          ...s,
          error: (error as Error).message ?? "Audio generation failed.",
        }))
      }
    } finally {
      if (ttsAbortRef.current === ttsController) ttsAbortRef.current = null
      setLoadingAudioMessageId((currentLoadingId) => (currentLoadingId === message.id ? null : currentLoadingId))
    }
  }, [playingMessageId, stopAudioPlayback, voiceAgentConfig])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>AI Conversation</SheetTitle>
          <SheetDescription>
            Use Simulate Interview for AI vs AI, or Start Interview to answer as the candidate.
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
              <>
                <Button
                  size="sm"
                  onClick={() => void runConversation("ai-vs-ai")}
                  disabled={!callPrompt.trim()}
                  className="gap-2"
                >
                  <Play className="size-4" />
                  Simulate Interview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runConversation("human-candidate")}
                  disabled={!callPrompt.trim()}
                  className="gap-2"
                >
                  <Play className="size-4" />
                  Start Interview
                </Button>
              </>
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
                onClick={() => setIsVoiceAgentModalOpen(true)}
                title="Voice agent settings"
              >
                <Settings2 className="size-4" />
              </Button>
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

          {mode === "ai-vs-ai" && (
            <>
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
            </>
          )}

        </div>

        {state.error && (
          <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="min-h-0 flex-1 px-4 pb-4">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <ScrollArea ref={scrollRef} className="min-h-0 flex-1 rounded-md border">
              {viewMode === "json" && hasMessages ? (
                <pre className="whitespace-pre-wrap p-4 font-mono text-sm text-foreground">
                  {JSON.stringify(state.messages, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-col gap-4 p-4">
                  {!hasMessages && !state.isRunning && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      {mode === "ai-vs-ai"
                        ? "Click Start to begin the conversation between the interviewer and candidate agents."
                        : "Click Start Interview to generate the interviewer opening question."}
                    </p>
                  )}
                {state.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isPlaying={playingMessageId === msg.id}
                    isLoading={loadingAudioMessageId === msg.id}
                    onToggleAudio={() => void handleToggleMessageAudio(msg)}
                  />
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

            {mode === "human-candidate" && state.isRunning && (
              <div className="shrink-0 rounded-md border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Your response as candidate
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={candidateInput}
                    onChange={(event) => setCandidateInput(event.target.value)}
                    onKeyDown={handleCandidateInputKeyDown}
                    disabled={activeAgent === "interviewer" || state.currentTurn >= maxTurns}
                    placeholder="Type your response and press Enter..."
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSubmitCandidateMessage()}
                    disabled={
                      !candidateInput.trim() ||
                      activeAgent === "interviewer" ||
                      state.currentTurn >= maxTurns
                    }
                  >
                    Send
                  </Button>
                </div>
                {state.currentTurn >= maxTurns && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Maximum turns reached. Start a new interview to continue.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
      <Dialog open={isVoiceAgentModalOpen} onOpenChange={setIsVoiceAgentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Agent Configuration</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="tts-voice-select" className="text-sm font-medium text-foreground">
                Voice
              </label>
              <Select
                value={voiceAgentConfig.voiceId}
                onValueChange={(voiceId) => {
                  const selectedVoiceOption = getVoiceOptionById(voiceId)
                  if (!selectedVoiceOption) return

                  setVoiceAgentConfig((prev) => buildVoiceAgentConfig({
                    ...prev,
                    provider: selectedVoiceOption.provider,
                    voiceId: selectedVoiceOption.id,
                  }))
                }}
                disabled={loadingAudioMessageId !== null}
              >
                <SelectTrigger id="tts-voice-select">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_AGENT_OPTIONS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tts-speaking-rate-modal" className="text-sm font-medium text-foreground">
                Speed
              </label>
              <Input
                id="tts-speaking-rate-modal"
                type="number"
                min={0.5}
                max={2}
                step={0.1}
                value={voiceAgentConfig.speakingRate}
                onChange={(event) =>
                  setVoiceAgentConfig((prev) =>
                    buildVoiceAgentConfig({
                      ...prev,
                      speakingRate: Number(event.target.value),
                    }),
                  )
                }
                disabled={loadingAudioMessageId !== null}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function MessageBubble({
  message,
  isPlaying,
  isLoading,
  onToggleAudio,
}: {
  message: ConversationMessage
  isPlaying: boolean
  isLoading: boolean
  onToggleAudio: () => void
}) {
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
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {isInterviewer ? "Interviewer" : "Candidate"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onToggleAudio}
            disabled={isLoading}
            title={isPlaying ? "Stop audio" : "Play audio"}
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : isPlaying ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </Button>
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}

interface VoiceAgentConfig {
  provider: "deepgram" | "cartesia"
  voiceId: string
  speakingRate: number
}

interface VoiceOption {
  provider: "deepgram" | "cartesia"
  id: string
  label: string
}

interface TextToSpeechRequestPayload {
  text: string
  provider: "deepgram" | "cartesia"
  voiceId: string
  speakingRate: number
}

const DEFAULT_VOICE_AGENT_CONFIG: VoiceAgentConfig = {
  provider: "cartesia",
  voiceId: "f786b574-daa5-4673-aa0c-cbe3e8534c02",
  speakingRate: 1,
}

const VOICE_AGENT_OPTIONS: VoiceOption[] = [
  { provider: "deepgram", id: "aura-2-asteria-en", label: "Deepgram - Asteria" },
  { provider: "deepgram", id: "aura-2-luna-en", label: "Deepgram - Luna" },
  { provider: "deepgram", id: "aura-2-thalia-en", label: "Deepgram - Thalia" },
  { provider: "deepgram", id: "aura-2-orion-en", label: "Deepgram - Orion" },
  { provider: "cartesia", id: "f786b574-daa5-4673-aa0c-cbe3e8534c02", label: "Cartesia - Custom" },
]

function buildVoiceAgentConfig(partial?: Partial<VoiceAgentConfig>): VoiceAgentConfig {
  const nextProvider = partial?.provider
  const nextVoiceId = partial?.voiceId?.trim()
  const candidateSpeakingRate = partial?.speakingRate
  const isSpeakingRateValid = typeof candidateSpeakingRate === "number" && Number.isFinite(candidateSpeakingRate)

  return {
    provider: nextProvider === "deepgram" ? "deepgram" : "cartesia",
    voiceId: nextVoiceId || DEFAULT_VOICE_AGENT_CONFIG.voiceId,
    speakingRate: isSpeakingRateValid ? candidateSpeakingRate : DEFAULT_VOICE_AGENT_CONFIG.speakingRate,
  }
}

function createMessageAudioKey(messageId: string, config: VoiceAgentConfig): string {
  return `${messageId}:${config.provider}:${config.voiceId}:${config.speakingRate}`
}

function getVoiceOptionById(voiceId: string): VoiceOption | null {
  const option = VOICE_AGENT_OPTIONS.find((voice) => voice.id === voiceId)
  if (!option) return null
  return option
}

async function requestTtsAudio(payload: TextToSpeechRequestPayload, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch("/api/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Failed to generate audio" }))
    throw new Error(errorBody.error ?? `HTTP ${response.status}`)
  }

  return response.blob()
}

export {
  buildVoiceAgentConfig,
  createMessageAudioKey,
  getVoiceOptionById,
  requestTtsAudio,
  DEFAULT_VOICE_AGENT_CONFIG,
  VOICE_AGENT_OPTIONS,
}

export type {
  VoiceAgentConfig,
  VoiceOption,
  TextToSpeechRequestPayload,
}

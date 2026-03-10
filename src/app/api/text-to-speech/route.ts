import { NextResponse } from "next/server"

interface TextToSpeechRequest {
  text?: unknown
  provider?: unknown
  voiceId?: unknown
  speakingRate?: unknown
}

const DEFAULT_VOICE_ID = "f786b574-daa5-4673-aa0c-cbe3e8534c02"
const DEFAULT_PROVIDER = "cartesia"

function parseStringValue(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function parseSpeakingRate(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  if (parsed > 2) return null
  return parsed
}

export async function POST(request: Request) {
  let body: TextToSpeechRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const text = parseStringValue(body.text)
  const providerRaw = parseStringValue(body.provider).toLowerCase()
  const provider = providerRaw === "deepgram" ? "deepgram" : DEFAULT_PROVIDER
  const voiceId = parseStringValue(body.voiceId) || DEFAULT_VOICE_ID
  const speakingRate = parseSpeakingRate(body.speakingRate)

  if (!text)
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 },
    )

  if (provider === "cartesia") {
    const cartesiaApiKey = process.env.CARTESIA_API_KEY ?? process.env.CARTESIA_KEY
    if (!cartesiaApiKey)
      return NextResponse.json(
        { error: "CARTESIA_API_KEY is not configured" },
        { status: 500 },
      )

    try {
      const cartesiaResponse = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
          "X-API-Key": cartesiaApiKey,
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "sonic-2",
          transcript: text,
          voice: {
            mode: "id",
            id: voiceId,
          },
          output_format: {
            container: "mp3",
            encoding: "mp3",
            sample_rate: 44100,
          },
        }),
      })

      if (!cartesiaResponse.ok) {
        const errorBody = await cartesiaResponse.text().catch(() => "")
        return NextResponse.json(
          { error: `Cartesia TTS request failed: ${errorBody || cartesiaResponse.statusText}` },
          { status: 502 },
        )
      }

      const audioBuffer = await cartesiaResponse.arrayBuffer()
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return NextResponse.json(
        { error: `Cartesia TTS request failed: ${message}` },
        { status: 502 },
      )
    }
  }

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY ?? process.env.DEEPRAM_API_KEY
  if (!deepgramApiKey)
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 },
    )

  const query = new URLSearchParams({
    model: voiceId,
    encoding: "mp3",
  })

  if (speakingRate !== null)
    query.set("speed", speakingRate.toString())

  try {
    const deepgramResponse = await fetch(`https://api.deepgram.com/v1/speak?${query.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (!deepgramResponse.ok) {
      const errorBody = await deepgramResponse.text().catch(() => "")
      return NextResponse.json(
        { error: `Deepgram TTS request failed: ${errorBody || deepgramResponse.statusText}` },
        { status: 502 },
      )
    }

    const audioBuffer = await deepgramResponse.arrayBuffer()
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Deepgram TTS request failed: ${message}` },
      { status: 502 },
    )
  }
}

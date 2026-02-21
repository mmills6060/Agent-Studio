import OpenAI from "openai"
import { NextResponse } from "next/server"

interface ScoringRequest {
  scoringPrompt: string
  conversation: string
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: ScoringRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { scoringPrompt, conversation } = body

  if (!scoringPrompt || !conversation)
    return NextResponse.json(
      { error: "scoringPrompt and conversation are required" },
      { status: 400 },
    )

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: scoringPrompt },
        { role: "user", content: conversation },
      ],
    })

    const result = completion.choices[0]?.message?.content ?? ""

    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 502 },
    )
  }
}

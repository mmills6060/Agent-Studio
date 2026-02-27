import OpenAI from "openai"
import { NextResponse } from "next/server"

interface ContextPromptRequest {
  contextPrompt: string
  resumeJson: unknown
}

const RESUME_PLACEHOLDER = /(here\s+is\s+the\s+resume\s*:?)\s*\n*/im

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: ContextPromptRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { contextPrompt, resumeJson } = body

  if (!contextPrompt)
    return NextResponse.json(
      { error: "contextPrompt is required" },
      { status: 400 },
    )

  const resumeText =
    resumeJson != null
      ? typeof resumeJson === "string"
        ? resumeJson
        : JSON.stringify(resumeJson, null, 2)
      : ""

  const userContent =
    resumeText.trim().length > 0
      ? contextPrompt.replace(
          RESUME_PLACEHOLDER,
          (_, prefix) => `${prefix}\n\n${resumeText}`,
        )
      : contextPrompt

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a Resume Analyzer. Follow the instructions in the user message exactly. Output only the requested JSON or structure, with no code fences or extra commentary.",
        },
        { role: "user", content: userContent },
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

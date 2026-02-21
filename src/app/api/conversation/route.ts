import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

interface HistoryMessage {
  role: "user" | "model"
  content: string
}

interface ConversationRequest {
  systemPrompt: string
  history: HistoryMessage[]
  agentRole: "interviewer" | "candidate"
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: ConversationRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { systemPrompt, history, agentRole } = body

  if (!systemPrompt || !agentRole)
    return NextResponse.json(
      { error: "systemPrompt and agentRole are required" },
      { status: 400 },
    )

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    })

    const allMessages = history ?? []
    const chatHistory = allMessages.length > 0 ? allMessages.slice(0, -1) : []
    const lastMessage = allMessages.length > 0
      ? allMessages[allMessages.length - 1].content
      : "Begin the conversation."

    const formattedHistory = chatHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }))

    if (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
      formattedHistory.unshift({
        role: "user",
        parts: [{ text: "Begin the conversation." }],
      })
    }

    const chat = model.startChat({ history: formattedHistory })
    const result = await chat.sendMessage(lastMessage)
    const text = result.response.text()

    return NextResponse.json({ message: text, agentRole })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Gemini API error: ${message}` },
      { status: 502 },
    )
  }
}

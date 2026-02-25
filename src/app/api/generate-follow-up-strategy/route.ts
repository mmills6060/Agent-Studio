import OpenAI from "openai"
import { NextResponse } from "next/server"

interface FollowUpStrategyRequest {
  question: string
  sectionLabel: string
  systemInstruction: string
  siblingQuestions: string[]
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: FollowUpStrategyRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { question, sectionLabel, systemInstruction, siblingQuestions } = body

  if (!question?.trim())
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 },
    )

  const systemPrompt = `You are an expert at designing follow-up strategies for AI-driven phone screen interviews. Given an interview question, you generate a concise follow-up strategy that tells the AI interviewer how to handle different candidate responses.

Your follow-up strategies should:
- Be concise and use bullet points or short lines
- Cover the main response paths (yes/no, detailed/vague, clear/unclear)
- Specify what clarifying questions to ask based on the candidate's answer
- Use conditional language like "If yes:", "If no:", "If vague:", "If they mention X:"
- Focus on extracting the specific information the question is trying to gather
- Not be overly long — typically 2-5 bullet points

Here are examples of good follow-up strategies:

Example 1 (for "Do you have a valid driver's license with a clean driving record?"):
- Confirm yes/no.
- If yes but they mention restrictions/issues: ask what the restriction is (only if they volunteer it) and note it.

Example 2 (for "What is your highest level of education?"):
- If they list multiple items, confirm the highest completed level.
- If yes to a bachelor's degree or master's degree, confirm whether degree is in a core science or lab science. And if so, what discipline?
- If in progress, confirm expected completion timing.

Example 3 (for "Do you hold an EMTB, AEMT, or CCMA certification?"):
- Clarify which certification(s) they hold.
- Confirm whether it's active/current (or pending) if not stated.

Example 4 (for "Describe a time when you went above and beyond for a patient."):
- If needed, prompt for specifics: What was the situation, what did they do, and what was the outcome?
- If they say they can't think of one: ask for a similar example of advocating for a patient or providing extra support.

Respond with ONLY the follow-up strategy text. No headers, no labels, no extra explanation.`

  const contextParts: string[] = []
  if (sectionLabel) contextParts.push(`Section: "${sectionLabel}"`)
  if (systemInstruction) contextParts.push(`Section objective: ${systemInstruction}`)
  if (siblingQuestions.length > 0)
    contextParts.push(`Other questions in this section:\n${siblingQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}`)

  const userPrompt = `${contextParts.length > 0 ? contextParts.join("\n\n") + "\n\n" : ""}Generate a follow-up strategy for this interview question:\n"${question}"`

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const strategy = completion.choices[0]?.message?.content?.trim() ?? ""

    if (!strategy)
      return NextResponse.json(
        { error: "LLM returned empty response" },
        { status: 502 },
      )

    return NextResponse.json({ strategy })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 502 },
    )
  }
}

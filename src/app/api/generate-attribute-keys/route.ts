import OpenAI from "openai"
import { NextResponse } from "next/server"

interface Question {
  label: string
  question: string
}

interface AttributeKeysRequest {
  sectionLabel: string
  questions: Question[]
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: AttributeKeysRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { sectionLabel, questions } = body

  if (!questions || questions.length === 0)
    return NextResponse.json(
      { error: "questions array is required and must not be empty" },
      { status: 400 },
    )

  const questionsDescription = questions
    .map((q, i) => `${i + 1}. Label: "${q.label}" | Question: "${q.question}"`)
    .join("\n")

  const systemPrompt = `You generate concise, unique snake_case attribute keys for interview scoring rubrics.

Rules:
- Each key must be unique across the set
- Keys should be 2-4 words in snake_case (e.g. "problem_solving", "technical_depth", "communication_clarity")
- Keys should capture the core competency or skill being evaluated by the question, NOT just restate the question topic
- Keys must be descriptive enough to understand what's being measured without seeing the question
- Do not use generic keys like "question_1" or "answer_quality"

Respond with ONLY a JSON array of strings, one key per question, in the same order as the input. No explanation.`

  const userPrompt = `Section: "${sectionLabel}"

Questions:
${questionsDescription}

Generate a unique attribute key for each question that captures the specific competency or skill being evaluated.`

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "[]"
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim()

    let keys: string[]
    try {
      keys = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 502 },
      )
    }

    if (!Array.isArray(keys) || keys.length !== questions.length)
      return NextResponse.json(
        { error: "LLM returned unexpected number of keys" },
        { status: 502 },
      )

    const sanitized = keys.map((k) =>
      String(k)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, ""),
    )

    const deduped = ensureUnique(sanitized)

    return NextResponse.json({ keys: deduped })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 502 },
    )
  }
}

function ensureUnique(keys: string[]): string[] {
  const seen = new Set<string>()
  return keys.map((key) => {
    let candidate = key
    let suffix = 2
    while (seen.has(candidate)) {
      candidate = `${key}_${suffix}`
      suffix++
    }
    seen.add(candidate)
    return candidate
  })
}

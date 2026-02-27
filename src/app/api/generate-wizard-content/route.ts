import OpenAI from "openai"
import { NextResponse } from "next/server"

interface QuestionInput {
  question: string
  points: number
  scoringGuidance: string
}

interface CategoryInput {
  name: string
  questions: QuestionInput[]
}

interface WizardContentRequest {
  interviewerName: string
  companyName: string
  roleTitle: string
  categories: CategoryInput[]
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: WizardContentRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { interviewerName, companyName, roleTitle, categories } = body

  if (!interviewerName?.trim() || !companyName?.trim() || !roleTitle?.trim())
    return NextResponse.json(
      { error: "interviewerName, companyName, and roleTitle are all required" },
      { status: 400 },
    )

  if (!categories || categories.length === 0)
    return NextResponse.json(
      { error: "At least one category is required" },
      { status: 400 },
    )

  const categorySummary = categories
    .map((cat, ci) => {
      const questionsList = cat.questions
        .map(
          (q, qi) =>
            `    ${qi + 1}. Question: "${q.question}" (${q.points} points)\n       Scoring guidance: "${q.scoringGuidance}"`,
        )
        .join("\n")
      return `  Category ${ci + 1}: "${cat.name}"\n${questionsList}`
    })
    .join("\n\n")

  const systemPrompt = `You are an expert interview prompt designer. Given interview metadata and a structured set of categories with questions, generate the per-category content needed for an AI phone screen interview prompt.

You must respond with valid JSON matching this exact structure:
{
  "categories": [
    {
      "name": "<category name>",
      "systemInstruction": "<system instruction for this interview section>",
      "questions": [
        {
          "followUpStrategy": "<follow-up strategy for this question>",
          "scoreLevels": [
            { "value": <max_points>, "description": "<description for top score>" },
            ...down to...
            { "value": 0, "description": "<description for zero score>" }
          ]
        }
      ]
    }
  ]
}

Guidelines for each field:

SYSTEM INSTRUCTION (per category): Write a brief (1-2 sentence) instruction telling the AI what this section evaluates and how to approach it.

FOLLOW-UP STRATEGY (per question): Write 2-5 bullet points describing how to follow up based on candidate responses. Use conditional language like "If yes:", "If vague:", etc. Be specific to the question content.

SCORE LEVELS (per question): Generate score level descriptions from the max points down to 0. Each level should clearly describe what constitutes that score, informed by the scoring guidance provided. The number of levels should be max_points + 1 (e.g., a 3-point question has levels 3, 2, 1, 0).

Respond with ONLY the JSON object. No markdown, no explanation.`

  const userPrompt = `Interview Setup:
- AI Interviewer: ${interviewerName}
- Company: ${companyName}
- Role: ${roleTitle}

Categories and Questions:
${categorySummary}

Generate the per-category content (system instructions, follow-up strategies, and score levels).`

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"

    let result
    try {
      result = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 502 },
      )
    }

    if (!result.categories)
      return NextResponse.json(
        { error: "LLM response missing required fields" },
        { status: 502 },
      )

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 502 },
    )
  }
}

import OpenAI from "openai"
import { NextResponse } from "next/server"

const SYSTEM_PROMPT = `You are a scoring prompt parser. Given a free-form scoring rubric/prompt, extract its structure into valid JSON.

Analyze the text and identify these components:

1. **overview** — Any introductory text describing what is being evaluated, the context, or purpose. If present, extract it.
2. **input_contexts** — Any sections describing specific inputs the evaluator should reference (e.g., "Important input: Resume Context"). Extract each as a separate entry.
3. **attributes** — Each scorable dimension/attribute. For each, extract:
   - "label": Human-readable name (e.g. "Education Level")
   - "attribute_key": A snake_case key suitable for JSON output (e.g. "education_points"). If the prompt defines explicit JSON keys, use those exactly. Otherwise, derive a concise snake_case key from the label.
   - "max_points": The maximum point value for this attribute (number)
   - "score_levels": Array of possible scores, each with:
     - "value": Numeric score (number)
     - "description": What this score level means
4. **scoring_instructions** — Any procedural instructions for how to assign scores (step-by-step process, rules about not inferring, etc.). Extract as plain text.
5. **evaluator_guardrails** — Any guardrail rules for the evaluator (bias avoidance, evidence requirements, etc.). Extract as plain text. If there are no explicit guardrails but the scoring instructions contain guardrail-like rules (e.g. "Do not infer or assume"), extract those into guardrails.
6. **output_format** — The expected output format. If the prompt includes a JSON template or output specification, extract the raw text. If the prompt defines explicit JSON keys in an output template, preserve them exactly.

Respond with ONLY valid JSON matching this schema — no markdown, no explanation:

{
  "overview": { "label": "string", "content": "string" } | null,
  "input_contexts": [{ "label": "string", "content": "string" }],
  "attributes": [
    {
      "label": "string",
      "attribute_key": "string",
      "max_points": number,
      "score_levels": [
        { "value": number, "description": "string" }
      ]
    }
  ],
  "scoring_instructions": "string or null",
  "evaluator_guardrails": "string or null",
  "output_format": "string or null"
}`

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    )

  let body: { prompt: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const { prompt } = body
  if (!prompt?.trim())
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 },
    )

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON", raw: cleaned },
        { status: 502 },
      )
    }

    return NextResponse.json({ parsed })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 502 },
    )
  }
}

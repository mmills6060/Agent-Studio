import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"

interface UpdateContextPromptRequest {
  promptId?: unknown
  prompt?: unknown
}

interface CreateContextPromptRequest {
  taskId?: unknown
  prompt?: unknown
}

interface ContextPromptRow {
  PromptId: number
  TaskId: number
  Prompt: string
  CreatedAt: string
  UpdatedAt: string
}

const DEFAULT_CONTEXT_PROMPT = `You are a Resume Analyzer who will receive information parsed from a Resume, and output information that will serve as reference to a Recruiter as they conduct a Pre-screening Interviewer over a call with a Candidate.

You will be provided a list of attributes to generate scores on based on information in the Resume.
You will output a score of "0", "1", or "n/a" on every attribute provided.
If the score is "0" or "1", you will provide a rationale for the score.
If the score is "n/a", you will provide info for the attribute.

The output should be a JSON document without any code block or formatting tags, with the following schema :
{
  nameInfo: NameInfo;
  attributeInfo: AttributeInfo[];
}

NameInfo schema:
{
  full_name: string; // candidate's full name
  first_name: string; // candidate's first name
  last_name: string; // candidate's last name
}

AttributeInfo schema:
{
  attribute: string; // name of attribute
  score: int;  // "0", "1", or "n/a"
  rationale: string; // rational for the score which will be provided if the score is "0" or "1"
  info: string // info to include if the score is "n/a"
}

Populate the nameInfo object based on the candidate's full name, first name, and last name.

Here is a list of attributes and the conditions to use to assign a score for that attribute.

Attribute 1 : No Employment Gaps
Conditions
- score a "1" if the candidate has maintained continuous employment without gaps of six months or more in between work experiences
- score a "0" otherwise

Attribute 2 : Presently Employed
Conditions
- score a "1" if the candidate is currently employed in any capacity
- score a "0" otherwise

Attribute 3 : No Job Hopping
Conditions
- score a "1" if the candidate has maintained reasonable job tenure without frequent short-term roles. Frequent job changes (less than 12 months per role) without clear career progression may indicate a pattern of job-hopping,
- score a "0" otherwise

Attribute 4 : Stable Career Progression
Conditions
- score a "1" if the candidate has shown upward mobility, increasing responsibilities, or movement into higher-level roles over time
- score a "0" otherwise

Attribute 5 : Relevant Work Experience
Conditions
- score a "1" if the candidate's prior work experience aligns with the responsibilities of the medical assistant role. Relevant experience may include working in a hospital, clinic, or any healthcare setting where the candidate performed duties related to patient care, medical procedures, or administrative tasks.
- score a "0" otherwise

Attribute 6 : Consistent Employment Dates
Conditions
- score an "n/a"
- in info, mention the number of discrepancies in the candidate's work history

Attribute 7 : Number of Jobs
Conditions
- score an "n/a"
- in info, mention the number of past job roles the candidate has held

Attribute 7 : Years of Experience
Conditions
- score an "n/a"
- in info, mention the number (in years) of total professional work experience the candidate has

Attribute 8 : Average Tenure per Role
Conditions
- score an "n/a"
- in info, mention the average duration of stay per job (in years)

 Here is the Resume :`

function parseStringValue(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function parseRawStringValue(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
}

function parseTaskId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0)
    return value

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const promptId = searchParams.get("promptId")?.trim() ?? ""
  const taskId = searchParams.get("taskId")?.trim() ?? ""

  if (!promptId && !taskId)
    return NextResponse.json(
      { error: "promptId or taskId is required" },
      { status: 400 },
    )

  try {
    const whereClause = promptId ? "PromptId = ?" : "TaskId = ?"
    const paramValue = promptId || taskId

    const result = await executeSqlQuery(
      `
        SELECT PromptId, TaskId, Prompt, CreatedAt, UpdatedAt
        FROM prodtake2ai.PromptsToGenerateContextForCandidate
        WHERE ${whereClause}
        ORDER BY CreatedAt DESC
      `,
      [paramValue],
    )

    return NextResponse.json({
      rows: result.rows as unknown as ContextPromptRow[],
      rowCount: result.rowCount,
    })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Context prompt query failed: ${message}` },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  let body: CreateContextPromptRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const taskId = parseTaskId(body.taskId)
  if (!taskId)
    return NextResponse.json(
      { error: "taskId is required and must be a positive integer" },
      { status: 400 },
    )

  const prompt = parseStringValue(body.prompt) || DEFAULT_CONTEXT_PROMPT

  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ")

    const result = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.PromptsToGenerateContextForCandidate
          (TaskId, Prompt, CreatedAt, UpdatedAt)
        VALUES (?, ?, ?, ?)
      `,
      [taskId, prompt, now, now],
    )

    const promptId = result.insertId
    if (!promptId)
      throw new SqlQueryValidationError("Failed to create context prompt", 502)

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.Tasks
        SET promptToGenerateContextForCandidateId = ?
        WHERE TaskID = ?
      `,
      [promptId, taskId],
    )

    return NextResponse.json({
      promptId: String(promptId),
      taskId: String(taskId),
      prompt,
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Context prompt creation failed: ${message}` },
      { status: 502 },
    )
  }
}

export async function PATCH(request: Request) {
  let body: UpdateContextPromptRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const promptId = parseStringValue(body.promptId)
  const prompt = parseRawStringValue(body.prompt)

  if (!promptId)
    return NextResponse.json(
      { error: "promptId is required" },
      { status: 400 },
    )

  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ")

    const result = await executeSqlMutation(
      `
        UPDATE prodtake2ai.PromptsToGenerateContextForCandidate
        SET Prompt = ?, UpdatedAt = ?
        WHERE PromptId = ?
        LIMIT 1
      `,
      [prompt, now, promptId],
    )

    if (result.affectedRows === 0)
      return NextResponse.json(
        { error: "Context prompt not found" },
        { status: 404 },
      )

    return NextResponse.json({ promptId })
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Context prompt update failed: ${message}` },
      { status: 502 },
    )
  }
}

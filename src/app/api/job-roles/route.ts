import { NextResponse } from "next/server"

import {
  executeSqlMutation,
  executeSqlQuery,
  SqlQueryValidationError,
} from "@/lib/database"

interface CreateJobRoleRequest {
  orgId?: unknown
  roleDescription?: unknown
  assessmentInstanceName?: unknown
  promptString?: unknown
}

interface CreateJobRoleResponse {
  roleId: string
  assessmentId: string
  assessmentInstanceId: string
  jobPositionId: string
  promptId: string
  phoneCallTaskId: string
  roleDescription: string
  assessmentInstanceName: string
  assessmentInstanceType: "JOB"
}

const defaultPromptAgentMetadata = JSON.stringify({
  agent: "pipeline",
  pipeline: {
    llm: "google",
    tts: "cartesia",
    stt_keywords:
      "Dispatch Health, Melissa, Nurse Practitioner, NP, telehealth, perimenopause, menopause, HRT, hormone replacement therapy, GLP-1, Wegovy, Ozempic, bio-identical pellets, oral progesterone, women's health, OB/GYN, primary care, prescriptive authority, board certification, compact license, multi-state license, disciplinary action, Google Workspace, Slack, EHR, AthenaHealth, Athena, Epic, Cerner, DrChrono, Kareo",
    llmGoogleModel: "gemini-2.5-flash",
    cartesia_voice_id: "b7d50908-b17c-442d-ad8d-810c63997ed9",
    llmGoogleVertexAI: "true",
    deepgram_stt_model: "nova-3",
    llm_fallback_chain: [
      { model: "gemini-2.5-flash", provider: "google" },
      { model: "claude-haiku-4-5-20251001", provider: "anthropic" },
    ],
    tts_fallback_chain: [
      { voice: "b7d50908-b17c-442d-ad8d-810c63997ed9", provider: "cartesia" },
      { voice: "OYTbf65OHHFELVut7v2H", provider: "elevenlabs" },
    ],
    allow_interruptions: "false",
    ttsElevenlabsVoiceId: "OYTbf65OHHFELVut7v2H",
    max_endpointing_delay: "4.0",
    min_endpointing_delay: "2.5",
    llm_fallback_max_retry: "1",
    ttsElevenlabsVoiceName: "Hope",
    tts_fallback_max_retry: "2",
    llmGoogleModelTemperature: "0.8",
    llmGoogleVertexAILocation: "us-east4",
    llmBeforeCallbackIsEnabled: "true",
    llm_fallback_retry_interval: "1.0",
    ttsElevenlabsVoiceStability: "0.71",
    llm_fallback_attempt_timeout: "5.0",
    deepgramSttRmsThresholdPreSquared: "0.016",
    isEndCallOnAgentSpeechEventHandler: "true",
    isEndCallOnAgentSpeechEventHandlerOnFarewellTerm: "true",
  },
  outbound_phone: {
    voicemail_msg:
      "Hi, this is Melissa, a virtual assistant calling on behalf of the recruitment team at Midi Health. I'm reaching out because you previously applied to the Nurse Practitioner Position with us. If you're interested, feel free to reply to the text message we just sent, or give us a call back at this number. Thanks, and I look forward to connecting with you soon!",
    is_first_agent_utterance_interruptable: "true",
  },
})

const defaultPhoneCallTaskMedia = JSON.stringify({
  image: "Valpak - Phone Call Image.png",
  videos: ["Valpak - Phone Call Cold.mp4"],
  thumbnails: ["Valpak - Phone Call Cold-Thumbnail.png"],
  profile_pic: "Valpak_Call_Bot_Profile_Pic_Samantha.png",
})

function parseStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value.trim()
}

function parseRawStringValue(value: unknown): string {
  if (typeof value !== "string")
    return ""

  return value
}

function parseDelimitedIds(value: unknown): string[] {
  if (typeof value !== "string")
    return []

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get("orgId")?.trim() ?? ""

  if (!orgId)
    return NextResponse.json(
      { error: "orgId is required" },
      { status: 400 },
    )

  try {
    const result = await executeSqlQuery(
      `
        SELECT
          jr.RoleID,
          jr.RoleLink,
          jr.RoleDescription,
          jr.PositionIDs,
          jr.OrgID,
          jr.Status,
          jr.RoleFile,
          jr.RoleImage,
          jr.RoleCode,
          jr.isDemo,
          jr.IsHidden,
          t.promptToGenerateContextForCandidateId AS ContextPromptId
        FROM prodtake2ai.JobRoles jr
        LEFT JOIN prodtake2ai.JobPositions jp ON jp.RoleID = jr.RoleID
        LEFT JOIN prodtake2ai.AssessmentInstances ai ON ai.AssessmentInstanceID = jp.AssessmentInstanceID
        LEFT JOIN prodtake2ai.Assessments a ON a.AssessmentID = ai.AssessmentID
        LEFT JOIN prodtake2ai.Tasks t
          ON FIND_IN_SET(t.TaskID, a.Tasks) > 0
          AND t.TaskModality = 'Phone Call'
          AND t.TaskSubModality = 'OutboundPhoneCall'
        WHERE jr.OrgID = ?
        ORDER BY jr.RoleDescription ASC
      `,
      [orgId],
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Job roles query failed: ${message}` },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  let body: CreateJobRoleRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    )
  }

  const orgId = parseStringValue(body.orgId)
  const roleDescription = parseStringValue(body.roleDescription)
  const assessmentInstanceName = parseStringValue(body.assessmentInstanceName)
  const promptString = parseRawStringValue(body.promptString)

  if (!orgId)
    return NextResponse.json(
      { error: "orgId is required" },
      { status: 400 },
    )

  if (!roleDescription)
    return NextResponse.json(
      { error: "roleDescription is required" },
      { status: 400 },
    )

  if (!assessmentInstanceName)
    return NextResponse.json(
      { error: "assessmentInstanceName is required" },
      { status: 400 },
    )

  try {
    const assessmentResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Assessments (Tasks)
        VALUES (?)
      `,
      [""],
    )

    const assessmentId = assessmentResult.insertId
    if (!assessmentId)
      throw new SqlQueryValidationError("Failed to create assessment", 502)

    const assessmentInstanceResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.AssessmentInstances (AssessmentID, AssessmentInstanceName, AssessmentInstanceType)
        VALUES (?, ?, ?)
      `,
      [assessmentId, assessmentInstanceName, "JOB"],
    )

    const assessmentInstanceId = assessmentInstanceResult.insertId
    if (!assessmentInstanceId)
      throw new SqlQueryValidationError("Failed to create assessment instance", 502)

    const industriesResult = await executeSqlQuery(
      `
        SELECT AssessmentInstanceIDs
        FROM prodtake2ai.Industries
        WHERE IndustryID = ?
        LIMIT 1
      `,
      [orgId],
    )

    const nextAssessmentInstanceIdValue = String(assessmentInstanceId)
    if (industriesResult.rowCount === 0) {
      await executeSqlMutation(
        `
          INSERT INTO prodtake2ai.Industries (IndustryID, AssessmentInstanceIDs)
          VALUES (?, ?)
        `,
        [orgId, nextAssessmentInstanceIdValue],
      )
    } else {
      const existingAssessmentInstanceIds = parseDelimitedIds(
        industriesResult.rows[0]?.AssessmentInstanceIDs,
      )
      const dedupedAssessmentInstanceIds = new Set(existingAssessmentInstanceIds)
      dedupedAssessmentInstanceIds.add(nextAssessmentInstanceIdValue)
      const updatedAssessmentInstanceIds = [...dedupedAssessmentInstanceIds].join(",")

      await executeSqlMutation(
        `
          UPDATE prodtake2ai.Industries
          SET AssessmentInstanceIDs = ?
          WHERE IndustryID = ?
        `,
        [updatedAssessmentInstanceIds, orgId],
      )
    }

    const roleResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.JobRoles
          (RoleLink, RoleDescription, PositionIDs, OrgID, Status, RoleFile, RoleImage, RoleCode, isDemo, IsHidden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ["", roleDescription, "", orgId, "Active", "", "CallCenterRoleImageValpak.jpg", "", 0, 0],
    )

    const roleId = roleResult.insertId
    if (!roleId)
      throw new SqlQueryValidationError("Failed to create role", 502)

    const promptResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Prompts (PromptString, PromptType, AgentMetaData)
        VALUES (?, ?, ?)
      `,
      [promptString, "Voice", defaultPromptAgentMetadata],
    )

    const promptId = promptResult.insertId
    if (!promptId)
      throw new SqlQueryValidationError("Failed to create prompt", 502)

    const welcomeTaskResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Tasks (PromptID, CriteriaIDs, TaskModality, TaskSubModality)
        VALUES (?, ?, ?, ?)
      `,
      [null, "", "Welcome", ""],
    )

    const welcomeTaskId = welcomeTaskResult.insertId
    if (!welcomeTaskId)
      throw new SqlQueryValidationError("Failed to create welcome task", 502)

    const phoneCallTaskResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.Tasks (PromptID, CriteriaIDs, TaskDescription, TaskMedia, TaskModality, TaskSubModality)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [promptId, "", "{}", defaultPhoneCallTaskMedia, "Phone Call", "OutboundPhoneCall"],
    )

    const phoneCallTaskId = phoneCallTaskResult.insertId
    if (!phoneCallTaskId)
      throw new SqlQueryValidationError("Failed to create phone call task", 502)

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.Assessments
        SET Tasks = ?
        WHERE AssessmentID = ?
      `,
      [`${welcomeTaskId},${phoneCallTaskId}`, assessmentId],
    )

    const jobPositionResult = await executeSqlMutation(
      `
        INSERT INTO prodtake2ai.JobPositions
          (Title, Description, Location, Status, EmployerIDs, AssessmentInstanceID, PositionLink, PositionFile, RoleID, IsCampaign, IsReferenceCheck)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [roleDescription, "", "", "Active", "", assessmentInstanceId, "", "", roleId, 0, 0],
    )

    const jobPositionId = jobPositionResult.insertId
    if (!jobPositionId)
      throw new SqlQueryValidationError("Failed to create job position", 502)

    await executeSqlMutation(
      `
        UPDATE prodtake2ai.JobRoles
        SET PositionIDs = ?
        WHERE RoleID = ?
      `,
      [String(jobPositionId), roleId],
    )

    const responseBody: CreateJobRoleResponse = {
      roleId: String(roleId),
      assessmentId: String(assessmentId),
      assessmentInstanceId: String(assessmentInstanceId),
      jobPositionId: String(jobPositionId),
      promptId: String(promptId),
      phoneCallTaskId: String(phoneCallTaskId),
      roleDescription,
      assessmentInstanceName,
      assessmentInstanceType: "JOB",
    }
    return NextResponse.json(responseBody)
  } catch (err) {
    if (err instanceof SqlQueryValidationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      )

    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Job role creation failed: ${message}` },
      { status: 502 },
    )
  }
}

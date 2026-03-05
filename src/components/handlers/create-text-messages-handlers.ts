interface CreateTextMessagesInput {
  orgId: string
  roleId: string
  positionId: string
  companyName: string
  interviewerName: string
}

interface CreateTextMessagesResult {
  textMessageIds: number[]
}

function buildInviteMessage(companyName: string, interviewerName: string): string {
  return `Hi {{CANDIDATE_FIRST_NAME}},

Thanks for applying to ${companyName}! We'd love to move you forward in the interview process for the {{ROLE_NAME}} role!.

The next step is a quick 5-minute call with ${interviewerName}, our virtual recruiting assistant — no prep is needed.

To get started, reply "YES" and ${interviewerName} will give you a call immediately. Reply "NO" to opt out.

We look forward to connecting with you!

– ${companyName}`
}

const PICKED_UP_MESSAGE = `Hi {{CANDIDATE_FIRST_NAME}},

It was great connecting with you!

If you had any issues during the call, you can re-do it by replying "9" now.

If you're happy with the call, we'd love your feedback – reply with a rating from "1" (lowest) to "5" (highest).

Thanks for your time and interest in the role!`

const DID_NOT_PICKUP_MESSAGE = `Hi {{CANDIDATE_FIRST_NAME}},

We tried to call you and got your voicemail.

Whenever you're ready, reply "9" to receive another call immediately.

We look forward to connecting with you!`

export async function createTextMessages(
  input: CreateTextMessagesInput,
): Promise<CreateTextMessagesResult> {
  const messages = [
    {
      messageType: "INVITE",
      messageContent: buildInviteMessage(input.companyName, input.interviewerName),
      associatedRoleId: null,
    },
    {
      messageType: "PICKED_UP",
      messageContent: PICKED_UP_MESSAGE,
      associatedRoleId: null,
    },
    {
      messageType: "DID_NOT_PICKUP",
      messageContent: DID_NOT_PICKUP_MESSAGE,
      associatedRoleId: null,
    },
  ]

  const response = await fetch("/api/text-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgId: input.orgId,
      roleId: input.roleId,
      positionId: input.positionId,
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error ?? "Failed to create text messages")
  }

  return response.json()
}

import { api } from "@/services/api"

export interface SendTestEmailPayload {
  to: string
  subject: string
  body: string
}

/**
 * Send a test email via Django backend API.
 * Uses the /emails/test/ endpoint for sending raw test emails.
 */
export async function sendEmail(payload: SendTestEmailPayload): Promise<void> {
  await api.post('/emails/test/', {
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
  })
}

/**
 * Email Management Hook
 *
 * Handles sending assignment notification emails to participants and
 * tracking email history. Supports both individual and bulk email sending.
 *
 * Email types:
 * - initial_assignment: First notification when participants are assigned
 * - final_assignment: Confirmation email before the event
 * - individual_update: Ad-hoc update for a single participant
 *
 * @example
 * const { emailLogs, sendEmailMutation, sendBulkEmailsMutation } = useEmails()
 *
 * // Send individual email
 * await sendEmailMutation.mutateAsync({ participant, restaurant, captain, tableGuests, emailType })
 *
 * // Send bulk emails to all assigned participants
 * await sendBulkEmailsMutation.mutateAsync({ emails: [...], emailType: 'final_assignment' })
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { EmailLog, EmailType, Participant, Restaurant } from "@/types/database"

/** Payload for sending an email to a single participant */
export interface SendEmailToParticipantPayload {
  participant: Participant
  restaurant: Restaurant
  captain: Participant | null
  tableGuests: Participant[]
  emailType: EmailType
}

export interface SendBulkEmailsPayload {
  emails: SendEmailToParticipantPayload[]
  emailType: EmailType
}

async function fetchEmailLogs(): Promise<EmailLog[]> {
  return api.get<EmailLog[]>('/emails/')
}

async function sendEmailToParticipant(payload: SendEmailToParticipantPayload): Promise<EmailLog> {
  // Send email via Django API - it handles template generation and logging
  return api.post<EmailLog>('/emails/send/', {
    participant_id: payload.participant.id,
    restaurant_id: payload.restaurant.id,
    email_type: payload.emailType,
  })
}

export interface BulkEmailResult {
  sent: EmailLog[]
  sent_count: number
  failed_count: number
  failures?: Array<{ participant_id: string; restaurant_id: string; error: string }>
}

async function sendBulkEmails(payload: SendBulkEmailsPayload): Promise<BulkEmailResult> {
  const emails = payload.emails.map((e) => ({
    participant_id: e.participant.id,
    restaurant_id: e.restaurant.id,
    email_type: e.emailType,
  }))

  return api.post<BulkEmailResult>('/emails/send_bulk/', { emails })
}

async function sendCaptainOverviews(): Promise<BulkEmailResult> {
  return api.post<BulkEmailResult>('/emails/send-captain-overviews/')
}

export function useEmails() {
  const queryClient = useQueryClient()

  const emailLogsQuery = useQuery({
    queryKey: queryKeys.emailLogs,
    queryFn: fetchEmailLogs,
  })

  const sendEmailMutation = useMutation({
    mutationFn: sendEmailToParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs })
    },
  })

  const sendBulkEmailsMutation = useMutation({
    mutationFn: sendBulkEmails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs })
    },
  })

  const sendCaptainOverviewsMutation = useMutation({
    mutationFn: sendCaptainOverviews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs })
    },
  })

  return {
    /** Array of all sent email records */
    emailLogs: emailLogsQuery.data ?? [],
    /** True while fetching email logs */
    isLoading: emailLogsQuery.isLoading,
    /** Manually refetch email logs */
    refetch: emailLogsQuery.refetch,
    /** Send email to a single participant */
    sendEmailMutation,
    /** Send emails to multiple participants at once */
    sendBulkEmailsMutation,
    /** Send captain overview emails to all captains */
    sendCaptainOverviewsMutation,
  }
}

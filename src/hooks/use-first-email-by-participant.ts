import { useMemo } from "react"
import type { EmailLog } from "@/types/database"

export interface FirstEmailInfo {
  /** ISO timestamp of when the email was sent */
  sentAt: string
  /** Type of email (initial_assignment, final_assignment, individual_update) */
  emailType: string
  /** Human-readable formatted date string */
  formattedDate: string
}

/**
 * Creates a lookup map of the first email sent to each participant.
 * Useful for showing email status indicators in participant lists.
 *
 * @param emailLogs - Array of email log entries from the useEmails hook
 * @returns Map with participant IDs as keys and first email info as values
 *
 * @example
 * const { emailLogs } = useEmails()
 * const firstEmailByParticipant = useFirstEmailByParticipant(emailLogs)
 * const emailInfo = firstEmailByParticipant.get(participantId)
 */
export function useFirstEmailByParticipant(emailLogs: EmailLog[]): Map<string, FirstEmailInfo> {
  return useMemo(() => {
    const map = new Map<string, FirstEmailInfo>()

    emailLogs.forEach((log) => {
      const sentAt = log.sent_at ?? log.created_at
      if (!sentAt) return

      const stored = map.get(log.participant_id)
      if (
        !stored ||
        new Date(sentAt).getTime() < new Date(stored.sentAt).getTime()
      ) {
        const date = new Date(sentAt)
        const formattedDate = !Number.isNaN(date.getTime())
          ? date.toLocaleString()
          : ""
        map.set(log.participant_id, {
          sentAt,
          emailType: log.email_type,
          formattedDate,
        })
      }
    })

    return map
  }, [emailLogs])
}

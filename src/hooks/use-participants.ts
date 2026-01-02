/**
 * Participants Data Hook
 *
 * Provides CRUD operations and data fetching for event participants.
 * Participants are people attending the event, imported from Pretix or added manually.
 * Each participant can be marked as a table captain who leads a restaurant group.
 *
 * @example
 * const { participants, createParticipant, syncFromPretix } = useParticipants()
 *
 * // Create new participant
 * await createParticipant.mutateAsync({ given_name: 'John', ... })
 *
 * // Sync from Pretix ticketing system
 * await syncFromPretix.mutateAsync()
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { Participant } from "@/types/database"

/** Payload for creating or updating a participant */
export interface ParticipantPayload {
  pretix_id?: number | null
  given_name: string
  family_name: string
  attendee_name: string
  attendee_email: string
  is_table_captain: boolean
  captain_phone?: string | null
  captain_preferred_contact?: string | null
  status?: Participant["status"]
  manual_status_override?: boolean
  manual_email_override?: boolean
}

export interface SyncResult {
  newParticipants: number
  updatedParticipants: number
  cancelledParticipants: number
  errors: Array<{ pretixId: number; reason: string }>
}

async function fetchParticipants(): Promise<Participant[]> {
  return api.get<Participant[]>('/participants/')
}

async function insertParticipant(payload: ParticipantPayload): Promise<Participant> {
  return api.post<Participant>('/participants/', payload)
}

async function updateParticipant(id: string, payload: Partial<ParticipantPayload>): Promise<Participant> {
  return api.patch<Participant>(`/participants/${id}/`, payload)
}

async function deleteParticipant(id: string): Promise<void> {
  return api.delete(`/participants/${id}/`)
}

export interface BulkImportResult {
  succeeded: number
  failed: number
  errors: Array<{ email: string; reason: string }>
}

async function bulkUpsertParticipants(payload: ParticipantPayload[]): Promise<BulkImportResult> {
  if (!payload.length) {
    return { succeeded: 0, failed: 0, errors: [] }
  }
  return api.post<BulkImportResult>('/participants/bulk_import/', payload)
}

async function syncParticipantsFromPretix(): Promise<SyncResult> {
  return api.post<SyncResult>('/participants/sync_pretix/')
}

export function useParticipants() {
  const queryClient = useQueryClient()

  const participantsQuery = useQuery({
    queryKey: queryKeys.participants.all,
    queryFn: fetchParticipants,
  })

  const createParticipant = useMutation({
    mutationFn: insertParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const editParticipant = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ParticipantPayload> }) =>
      updateParticipant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const removeParticipant = useMutation({
    mutationFn: deleteParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const bulkImportParticipants = useMutation({
    mutationFn: bulkUpsertParticipants,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const syncFromPretix = useMutation({
    mutationFn: syncParticipantsFromPretix,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  return {
    /** Array of all participants */
    participants: participantsQuery.data ?? [],
    /** True while fetching participants */
    isLoading: participantsQuery.isLoading,
    /** Manually refetch participants */
    refetch: participantsQuery.refetch,
    /** Create a new participant */
    createParticipant,
    /** Update an existing participant */
    editParticipant,
    /** Delete a participant */
    removeParticipant,
    /** Import multiple participants from CSV */
    bulkImportParticipants,
    /** Sync participants from Pretix ticketing system */
    syncFromPretix,
  }
}

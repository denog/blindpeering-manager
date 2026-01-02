/**
 * Assignments Data Hook
 *
 * Manages participant-to-restaurant assignments. An assignment links a participant
 * to a specific restaurant table. Note that captain assignments are stored directly
 * on the Restaurant record, not in the assignments table.
 *
 * @example
 * const { assignments, assignMutation, clearAssignmentsMutation } = useAssignments()
 *
 * // Assign participant to restaurant
 * await assignMutation.mutateAsync({ participant_id: '...', restaurant_id: '...' })
 *
 * // Remove participant from their table
 * await unassignMutation.mutateAsync(participantId)
 *
 * // Clear all assignments (before reshuffling)
 * await clearAssignmentsMutation.mutateAsync()
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { Assignment } from "@/types/database"

async function fetchAssignments(): Promise<Assignment[]> {
  return api.get<Assignment[]>('/assignments/')
}

async function upsertAssignment(payload: { participant_id: string; restaurant_id: string }): Promise<Assignment> {
  // Django API uses 'participant' and 'restaurant' as field names
  return api.post<Assignment>('/assignments/', {
    participant: payload.participant_id,
    restaurant: payload.restaurant_id,
  })
}

async function removeAssignment(participantId: string): Promise<void> {
  await api.delete(`/assignments/by-participant/${participantId}/`)
}

async function clearAllAssignments(): Promise<void> {
  await api.delete('/assignments/clear_all/')
}

export function useAssignments() {
  const queryClient = useQueryClient()

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.all,
    queryFn: fetchAssignments,
  })

  const assignMutation = useMutation({
    mutationFn: upsertAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: removeAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  const clearAssignmentsMutation = useMutation({
    mutationFn: clearAllAssignments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  return {
    /** Array of all participant-restaurant assignments */
    assignments: assignmentsQuery.data ?? [],
    /** True while fetching assignments */
    isLoading: assignmentsQuery.isLoading,
    /** Manually refetch assignments */
    refetch: assignmentsQuery.refetch,
    /** Assign a participant to a restaurant */
    assignMutation,
    /** Remove a participant from their assigned restaurant */
    unassignMutation,
    /** Clear all assignments (used before bulk reassignment) */
    clearAssignmentsMutation,
  }
}

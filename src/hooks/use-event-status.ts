/**
 * Event Status Hook
 *
 * Manages the global event workflow state. The event progresses through stages:
 *
 * 1. setup - Initial state, configuring restaurants and importing participants
 * 2. captains_assigned - Table captains have been assigned to restaurants
 * 3. participants_assigned - All participants have been assigned to tables
 * 4. finalized - Assignments are locked, event is ready
 *
 * @example
 * const { eventStatus, setEventStatusMutation } = useEventStatus()
 *
 * // Check current state
 * if (eventStatus.state === 'finalized') { ... }
 *
 * // Advance workflow state
 * await setEventStatusMutation.mutateAsync('participants_assigned')
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { EventStatus, EventWorkflowState } from "@/types/database"

/** Default state used before the backend returns actual status */
const DEFAULT_STATE: EventStatus = {
  id: "default",
  state: "setup",
  event_date: null,
  arrival_time: null,
  updated_at: new Date(0).toISOString(),
}

async function fetchEventStatus(): Promise<EventStatus> {
  return api.get<EventStatus>('/event-status/')
}

async function updateEventStatus(state: EventWorkflowState): Promise<EventStatus> {
  return api.patch<EventStatus>('/event-status/update_state/', { state })
}

export interface EventSettingsPayload {
  event_date?: string | null
  arrival_time?: string | null
}

async function updateEventSettings(settings: EventSettingsPayload): Promise<EventStatus> {
  return api.patch<EventStatus>('/event-status/update_state/', settings)
}

export function useEventStatus() {
  const queryClient = useQueryClient()

  const eventStatusQuery = useQuery({
    queryKey: queryKeys.eventStatus.all,
    queryFn: fetchEventStatus,
  })

  const setEventStatusMutation = useMutation({
    mutationFn: updateEventStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventStatus.all })
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: updateEventSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventStatus.all })
    },
  })

  return {
    /** Current event status including workflow state */
    eventStatus: eventStatusQuery.data ?? DEFAULT_STATE,
    /** True while fetching event status */
    isLoading: eventStatusQuery.isLoading,
    /** Manually refetch event status */
    refetch: eventStatusQuery.refetch,
    /** Update the workflow state */
    setEventStatusMutation,
    /** Update event settings (date, time) */
    updateSettingsMutation,
  }
}

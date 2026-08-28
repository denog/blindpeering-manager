/**
 * Carpool Board Hook
 *
 * Powers the public, token-authenticated carpool page for a single
 * participant's table. No session/login involved -- identity comes entirely
 * from the magic-link token in the URL.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { carpoolApi } from "@/services/carpool-api"
import { queryKeys } from "@/lib/query-keys"
import type { CarpoolBoard } from "@/types/database"

async function fetchCarpoolBoard(token: string): Promise<CarpoolBoard> {
  return carpoolApi.get<CarpoolBoard>(`/carpool/${token}/`)
}

async function postCarpoolMessage(token: string, body: string) {
  return carpoolApi.post(`/carpool/${token}/messages/`, { body })
}

async function deleteCarpoolMessage(token: string, messageId: string) {
  return carpoolApi.delete(`/carpool/${token}/messages/${messageId}/`)
}

export function useCarpool(token: string) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.carpool.byToken(token)

  const boardQuery = useQuery({
    queryKey,
    queryFn: () => fetchCarpoolBoard(token),
    // Live-ish board -- participants should see new messages without refreshing.
    // 60s keeps well under the per-token read throttle (120/hour) with room
    // for manual refreshes; a whole tableful of people on shared venue WiFi
    // each polls their own token bucket.
    refetchInterval: 60_000,
    // Don't hammer on transient failures, and pause polling while the tab is
    // hidden so a backgrounded phone doesn't burn the rate limit.
    refetchIntervalInBackground: false,
    retry: false,
  })

  const postMessage = useMutation({
    mutationFn: (body: string) => postCarpoolMessage(token, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => deleteCarpoolMessage(token, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
    error: boardQuery.error,
    postMessage,
    deleteMessage,
  }
}

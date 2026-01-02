/**
 * Restaurants Data Hook
 *
 * Provides CRUD operations and data fetching for restaurants.
 * Restaurants are venues where participants gather for the blind peering event.
 * Each restaurant has a capacity (max_seats), transport info, and can have an assigned captain.
 *
 * @example
 * const { restaurants, createRestaurant, editRestaurant } = useRestaurants()
 *
 * // Create new restaurant
 * await createRestaurant.mutateAsync({ name: 'Restaurant A', max_seats: 10, ... })
 *
 * // Assign captain to restaurant
 * await editRestaurant.mutateAsync({ id, payload: { assigned_captain_id: captainId } })
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { Restaurant } from "@/types/database"

/** Payload for creating or updating a restaurant */
export interface RestaurantPayload {
  name: string
  address: string
  phone?: string | null
  max_seats: number
  taxi_time?: number | null
  public_transport_time?: number | null
  public_transport_lines?: string | null
  assigned_captain_id?: string | null
  reservation_channel?: string | null
  reservation_name?: string | null
  reservation_confirmed?: string | null
}

async function fetchRestaurants(): Promise<Restaurant[]> {
  return api.get<Restaurant[]>('/restaurants/')
}

async function insertRestaurant(payload: RestaurantPayload): Promise<Restaurant> {
  return api.post<Restaurant>('/restaurants/', payload)
}

async function updateRestaurant(id: string, payload: Partial<RestaurantPayload>): Promise<Restaurant> {
  return api.patch<Restaurant>(`/restaurants/${id}/`, payload)
}

async function deleteRestaurant(id: string): Promise<void> {
  return api.delete(`/restaurants/${id}/`)
}

async function bulkInsertRestaurants(payload: RestaurantPayload[]): Promise<void> {
  if (!payload.length) {
    return
  }
  await api.post('/restaurants/bulk_import/', payload)
}

export function useRestaurants() {
  const queryClient = useQueryClient()

  const restaurantsQuery = useQuery({
    queryKey: queryKeys.restaurants.all,
    queryFn: fetchRestaurants,
  })

  const createRestaurant = useMutation({
    mutationFn: insertRestaurant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  const editRestaurant = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RestaurantPayload> }) => updateRestaurant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  const removeRestaurant = useMutation({
    mutationFn: deleteRestaurant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  const bulkImportRestaurants = useMutation({
    mutationFn: bulkInsertRestaurants,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  return {
    /** Array of all restaurants */
    restaurants: restaurantsQuery.data ?? [],
    /** True while fetching restaurants */
    isLoading: restaurantsQuery.isLoading,
    /** Manually refetch restaurants */
    refetch: restaurantsQuery.refetch,
    /** Create a new restaurant */
    createRestaurant,
    /** Update an existing restaurant (including captain assignment) */
    editRestaurant,
    /** Delete a restaurant */
    removeRestaurant,
    /** Import multiple restaurants from CSV */
    bulkImportRestaurants,
  }
}

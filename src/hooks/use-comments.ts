import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/services/api"
import { queryKeys } from "@/lib/query-keys"
import type { ParticipantComment, RestaurantComment } from "@/types/database"

/**
 * Supported entity types for comments
 */
export type CommentEntityType = "participant" | "restaurant"

/**
 * Comment type based on entity type
 */
type CommentType<T extends CommentEntityType> = T extends "participant"
  ? ParticipantComment
  : RestaurantComment

/**
 * Payload for creating a new comment
 */
export interface CreateCommentPayload {
  comment_text: string
}

/**
 * API endpoint and query key configuration per entity type
 */
const entityConfig = {
  participant: {
    endpoint: "/participant-comments/",
    queryKey: (id: string) => queryKeys.participantComments.byParticipant(id),
    foreignKey: "participant",
    filterParam: "participant_id",
  },
  restaurant: {
    endpoint: "/restaurant-comments/",
    queryKey: (id: string) => queryKeys.restaurantComments.byRestaurant(id),
    foreignKey: "restaurant",
    filterParam: "restaurant_id",
  },
} as const

async function fetchComments<T extends CommentEntityType>(
  entityType: T,
  entityId: string
): Promise<CommentType<T>[]> {
  const config = entityConfig[entityType]
  return api.get<CommentType<T>[]>(config.endpoint, { [config.filterParam]: entityId })
}

async function insertComment<T extends CommentEntityType>(
  entityType: T,
  entityId: string,
  commentText: string
): Promise<CommentType<T>> {
  const config = entityConfig[entityType]
  return api.post<CommentType<T>>(config.endpoint, {
    [config.foreignKey]: entityId,
    comment_text: commentText,
  })
}

async function updateComment<T extends CommentEntityType>(
  entityType: T,
  id: string,
  commentText: string
): Promise<CommentType<T>> {
  const config = entityConfig[entityType]
  return api.patch<CommentType<T>>(`${config.endpoint}${id}/`, { comment_text: commentText })
}

async function deleteComment<T extends CommentEntityType>(
  entityType: T,
  id: string
): Promise<void> {
  const config = entityConfig[entityType]
  return api.delete(`${config.endpoint}${id}/`)
}

/**
 * Generic hook for managing comments on any entity type (participant or restaurant).
 *
 * @param entityType - The type of entity ("participant" or "restaurant")
 * @param entityId - The ID of the entity to fetch/manage comments for
 *
 * @example
 * // For participant comments
 * const { comments, createComment } = useComments("participant", participantId)
 *
 * @example
 * // For restaurant comments
 * const { comments, createComment } = useComments("restaurant", restaurantId)
 */
export function useComments<T extends CommentEntityType>(entityType: T, entityId: string) {
  const queryClient = useQueryClient()
  const config = entityConfig[entityType]

  const commentsQuery = useQuery({
    queryKey: config.queryKey(entityId),
    queryFn: () => fetchComments(entityType, entityId),
    enabled: !!entityId,
  })

  const createComment = useMutation({
    mutationFn: (payload: CreateCommentPayload) =>
      insertComment(entityType, entityId, payload.comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey(entityId) })
    },
  })

  const editComment = useMutation({
    mutationFn: ({ id, comment_text }: { id: string; comment_text: string }) =>
      updateComment(entityType, id, comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey(entityId) })
    },
  })

  const removeComment = useMutation({
    mutationFn: (id: string) => deleteComment(entityType, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey(entityId) })
    },
  })

  return {
    comments: (commentsQuery.data ?? []) as CommentType<T>[],
    isLoading: commentsQuery.isLoading,
    createComment,
    editComment,
    removeComment,
  }
}

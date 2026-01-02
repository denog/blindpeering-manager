export const queryKeys = {
  restaurants: {
    all: ["restaurants"] as const,
  },
  participants: {
    all: ["participants"] as const,
  },
  assignments: {
    all: ["assignments"] as const,
  },
  eventStatus: {
    all: ["event-status"] as const,
  },
  emailLogs: ["email-logs"] as const,
  restaurantComments: {
    all: ["restaurant-comments"] as const,
    byRestaurant: (restaurantId: string) => ["restaurant-comments", restaurantId] as const,
  },
  participantComments: {
    all: ["participant-comments"] as const,
    byParticipant: (participantId: string) => ["participant-comments", participantId] as const,
  },
}

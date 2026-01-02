import type { Participant, Restaurant } from "@/types/database"
import { getDuplicateEmails } from "@/lib/utils"

export interface CaptainAssignmentPlan {
  restaurantId: string
  captainId: string
}

export interface ParticipantAssignmentPlan {
  participantId: string
  restaurantId: string
}

export interface RestaurantRoster {
  restaurant: Restaurant
  captain: Participant | null
  participants: Participant[]
}

/**
 * Randomly shuffles an array using the Fisher-Yates algorithm.
 * Returns a new array; does not mutate the original.
 */
const randomShuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}


export function planCaptainAssignments(restaurants: Restaurant[], captains: Participant[]): CaptainAssignmentPlan[] {
  if (!restaurants.length) {
    return []
  }

  const eligibleCaptains = captains.filter((captain) => captain.status !== "cancelled")

  if (eligibleCaptains.length < restaurants.length) {
    throw new Error(`Not enough captains. Need ${restaurants.length} but only have ${eligibleCaptains.length}.`)
  }

  const shuffledCaptains = randomShuffle(eligibleCaptains)

  return restaurants.map((restaurant, index) => ({
    restaurantId: restaurant.id,
    captainId: shuffledCaptains[index].id,
  }))
}

export function planParticipantAssignments(
  restaurants: Restaurant[],
  participants: Participant[],
  options?: { requireCaptain?: boolean; existingAssignmentCounts?: Map<string, number> },
): { assignments: ParticipantAssignmentPlan[]; unassigned: Participant[] } {
  const requireCaptain = options?.requireCaptain ?? true
  const existingAssignmentCounts = options?.existingAssignmentCounts ?? new Map()

  const eligibleRestaurants = restaurants.filter((restaurant) =>
    requireCaptain ? Boolean(restaurant.assigned_captain_id) : true,
  )

  /** Tracks remaining capacity and current assignment count per restaurant */
  const restaurantCapacityPools = eligibleRestaurants.map((restaurant) => ({
    id: restaurant.id,
    /** Max seats minus 1 (reserved for captain) */
    capacity: Math.max(restaurant.max_seats - 1, 0),
    /** Number of participants currently assigned (including existing assignments) */
    assigned: existingAssignmentCounts.get(restaurant.id) ?? 0,
  }))

  if (!restaurantCapacityPools.length) {
    return { assignments: [], unassigned: [...participants] }
  }

  // Detect duplicate emails to exclude them from assignment
  const duplicateEmails = getDuplicateEmails(participants, (p) => p.attendee_email)

  const shuffledParticipants = randomShuffle(
    participants.filter((participant) =>
      participant.status !== "cancelled" &&
      !duplicateEmails.has(participant.attendee_email.toLowerCase())
    )
  )

  const assignments: ParticipantAssignmentPlan[] = []
  const unassigned: Participant[] = []

  for (const participant of shuffledParticipants) {
    if (participant.is_table_captain) {
      continue
    }

    // Sort pools prioritizing:
    // 1. Restaurants with free capacity (assigned < capacity) come first
    // 2. Among those with free capacity, prefer ones with lower occupancy ratio
    // 3. For overbooking (assigned >= capacity), prefer ones with lower occupancy ratio (proportional distribution)
    // 4. Break ties by capacity (larger restaurants for fair distribution)
    const sortedPools = [...restaurantCapacityPools].sort((a, b) => {
      const aHasSpace = a.assigned < a.capacity
      const bHasSpace = b.assigned < b.capacity

      // Prioritize restaurants with free space over full ones
      if (aHasSpace !== bHasSpace) {
        return aHasSpace ? -1 : 1
      }

      // Calculate occupancy ratios (handle zero capacity edge case)
      const aRatio = a.capacity > 0 ? a.assigned / a.capacity : Infinity
      const bRatio = b.capacity > 0 ? b.assigned / b.capacity : Infinity

      // Prefer lower occupancy ratio for proportional distribution
      if (Math.abs(aRatio - bRatio) > 0.001) {
        return aRatio - bRatio
      }

      // Break ties by capacity (larger restaurants)
      return b.capacity - a.capacity
    })

    // First try to find a restaurant with free capacity
    let target = sortedPools.find((pool) => pool.capacity > 0 && pool.assigned < pool.capacity)

    // If no free capacity, assign to the restaurant with the least overbooking
    if (!target && sortedPools.length > 0 && sortedPools[0].capacity > 0) {
      target = sortedPools[0]
    }

    if (!target) {
      unassigned.push(participant)
      continue
    }

    assignments.push({ participantId: participant.id, restaurantId: target.id })

    const poolRef = restaurantCapacityPools.find((pool) => pool.id === target.id)
    if (poolRef) {
      poolRef.assigned += 1
    }
  }

  return { assignments, unassigned }
}

export function buildRestaurantRosters(
  restaurants: Restaurant[],
  participants: Participant[],
  assignments: ParticipantAssignmentPlan[],
): RestaurantRoster[] {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]))

  const rosterMap = new Map<string, RestaurantRoster>()

  restaurants.forEach((restaurant) => {
    const captain = restaurant.assigned_captain_id ? participantById.get(restaurant.assigned_captain_id) ?? null : null
    rosterMap.set(restaurant.id, {
      restaurant,
      captain,
      participants: [],
    })
  })

  assignments.forEach((assignment) => {
    const roster = rosterMap.get(assignment.restaurantId)
    const participant = participantById.get(assignment.participantId)
    if (roster && participant) {
      roster.participants.push(participant)
    }
  })

  return Array.from(rosterMap.values()).map((roster) => ({
    ...roster,
    participants: roster.participants.sort((left, right) => left.attendee_name.localeCompare(right.attendee_name)),
  }))
}

export function generateAssignmentCsv(rosters: RestaurantRoster[]): string {
  const header = [
    "Restaurant",
    "Address",
    "Captain",
    "Captain Email",
    "Captain Phone",
    "Participant Name",
    "Participant Email",
    "Pretix ID",
    "Status",
  ]

  const rows: string[][] = [header]

  rosters.forEach((roster) => {
    if (roster.participants.length === 0) {
      rows.push([
        roster.restaurant.name,
        roster.restaurant.address,
        roster.captain?.attendee_name ?? "",
        roster.captain?.attendee_email ?? "",
        roster.captain?.captain_phone ?? "",
        "",
        "",
        "",
        "",
      ])
    } else {
      roster.participants.forEach((participant, index) => {
        rows.push([
          index === 0 ? roster.restaurant.name : "",
          index === 0 ? roster.restaurant.address : "",
          index === 0 ? roster.captain?.attendee_name ?? "" : "",
          index === 0 ? roster.captain?.attendee_email ?? "" : "",
          index === 0 ? roster.captain?.captain_phone ?? "" : "",
          participant.attendee_name,
          participant.attendee_email,
          participant.pretix_id?.toString() ?? "",
          participant.status,
        ])
      })
    }
  })

  return rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")
}

export function buildRosterPrintHtml(rosters: RestaurantRoster[]): string {
  const sections = rosters
    .map((roster) => {
      const participantList = roster.participants
        .map(
          (participant) =>
            `<li><strong>${participant.attendee_name}</strong><br/><span>${participant.attendee_email}</span></li>`,
        )
        .join("")

      return `
        <section>
          <h2>${roster.restaurant.name}</h2>
          <p class="meta">${roster.restaurant.address}</p>
          <p class="meta">
            <strong>Captain:</strong>
            ${roster.captain ? `${roster.captain.attendee_name} (${roster.captain.attendee_email})` : "Unassigned"}
          </p>
          <ul>
            ${participantList || "<li>No participants assigned yet.</li>"}
          </ul>
        </section>
      `
    })
    .join("")

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Blind Peering Assignments</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2rem; color: #111; }
          h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }
          section { margin-bottom: 2rem; page-break-inside: avoid; }
          h2 { font-size: 1.25rem; margin-bottom: 0.25rem; }
          .meta { font-size: 0.9rem; color: #555; margin: 0.2rem 0; }
          ul { list-style: disc; margin-left: 1.5rem; }
          li { margin-bottom: 0.4rem; }
        </style>
      </head>
      <body>
        <h1>Blind Peering Restaurant Assignments</h1>
        ${sections}
      </body>
    </html>`
}

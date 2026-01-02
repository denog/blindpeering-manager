import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Creates a Map from an array of entities, keyed by their `id` property.
 * Useful for O(1) lookups when you need to find entities by ID frequently.
 *
 * @param items - Array of entities with an `id` property
 * @returns Map with entity IDs as keys and entities as values
 *
 * @example
 * const participantById = createEntityMap(participants)
 * const participant = participantById.get(someId)
 */
export function createEntityMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

/**
 * Detects duplicate email addresses in a list of entities with email fields.
 * Returns a Set of lowercase email addresses that appear more than once.
 *
 * @param items - Array of entities with an email property
 * @param emailAccessor - Function to extract the email from each entity
 * @returns Set of lowercase duplicate email addresses
 *
 * @example
 * const duplicates = getDuplicateEmails(participants, p => p.attendee_email)
 * if (duplicates.has(email.toLowerCase())) { ... }
 */
export function getDuplicateEmails<T>(
  items: T[],
  emailAccessor: (item: T) => string
): Set<string> {
  const emailCounts = new Map<string, number>()
  items.forEach((item) => {
    const email = emailAccessor(item).toLowerCase()
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
  })
  return new Set(
    Array.from(emailCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([email]) => email)
  )
}

/**
 * Small threshold for floating-point comparison when determining occupancy status.
 * Used to handle rounding errors when comparing occupancy ratios.
 */
export const OCCUPANCY_EPSILON = 0.001

/**
 * Returns the appropriate badge style classes based on restaurant occupancy.
 *
 * @param occupancy - Current number of assigned guests
 * @param capacity - Maximum capacity of the restaurant
 * @returns Tailwind CSS classes for the badge styling
 *
 * - Over capacity: destructive (red)
 * - At capacity: warning (amber)
 * - Under capacity: secondary (default)
 */
export function getOccupancyBadgeStyles(occupancy: number, capacity: number): string {
  const delta = capacity ? occupancy - capacity : occupancy

  if (delta > OCCUPANCY_EPSILON) {
    return "bg-destructive text-destructive-foreground"
  }
  if (Math.abs(delta) <= OCCUPANCY_EPSILON) {
    return "bg-amber-400/20 text-amber-600"
  }
  return "bg-secondary text-secondary-foreground"
}

/**
 * Pretix Integration Service
 *
 * Pretix is an open-source event ticketing system (https://pretix.eu).
 * This module provides API client functions to fetch attendee data from Pretix
 * for synchronizing participant information with the local database.
 *
 * Configuration requires:
 * - VITE_PRETIX_API_TOKEN: API authentication token
 * - VITE_PRETIX_EVENT: Event slug identifier
 */

// Pretix API types based on the API response structure
export interface PretixAttendeeNameParts {
  _scheme: string
  given_name: string
  family_name: string
}

export interface PretixAnswer {
  question: number
  answer: string
  question_identifier: string
  options: string[]
  option_identifiers: string[]
}

export interface PretixPosition {
  id: number
  order: string
  positionid: number
  item: number
  variation: number | null
  price: string
  attendee_name: string
  attendee_name_parts: PretixAttendeeNameParts
  company: string | null
  street: string | null
  zipcode: string | null
  city: string | null
  country: string | null
  state: string | null
  attendee_email: string | null
  voucher: number | null
  tax_rate: string
  tax_value: string
  secret: string
  addon_to: number | null
  subevent: number | null
  checkins: unknown[]
  answers: PretixAnswer[]
  order__status: string
  order__valid_if_pending: boolean
  order__require_approval: boolean
  require_attention: boolean
  blocked: string | null
}

export interface PretixResponse {
  count: number
  next: string | null
  previous: string | null
  results: PretixPosition[]
}

const PRETIX_BASE_URL = "https://pretix.eu/api/v1"

function getPretixHeaders(): HeadersInit {
  const token = import.meta.env.VITE_PRETIX_API_TOKEN
  if (!token) {
    throw new Error("VITE_PRETIX_API_TOKEN is not configured")
  }
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  }
}

export async function fetchPretixCheckinList(
  checkinListId: string,
  page: number = 1,
): Promise<PretixResponse> {
  const event = import.meta.env.VITE_PRETIX_EVENT
  if (!event) {
    throw new Error("VITE_PRETIX_EVENT is not configured")
  }

  // Extract organizer from event (format: organizer/event or just event)
  const organizer = "denog" // Hardcoded based on the Bruno file
  const eventSlug = event

  const url = `${PRETIX_BASE_URL}/organizers/${organizer}/events/${eventSlug}/checkinlists/${checkinListId}/positions/?page=${page}`

  const response = await fetch(url, {
    headers: getPretixHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Pretix API error: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

export async function fetchAllPretixPositions(checkinListId: string): Promise<PretixPosition[]> {
  const allPositions: PretixPosition[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetchPretixCheckinList(checkinListId, page)
    allPositions.push(...response.results)

    if (response.next) {
      page++
    } else {
      hasMore = false
    }
  }

  return allPositions
}

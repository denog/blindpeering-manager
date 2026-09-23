/**
 * Minimal API client for the public carpool board.
 *
 * Deliberately NOT the shared `api` client from `./api.ts`: that client
 * hard-redirects to `/login` on any 401/403, which would be wrong here --
 * an invalid/expired carpool token should show an inline message, not bounce
 * a participant to the staff login page. The carpool endpoints also clear
 * Django's authentication classes entirely, so no CSRF handling is needed.
 */

const API_BASE = '/api'

export class CarpoolApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'CarpoolApiError'
    this.status = status
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      message = body.detail ?? message
    } catch {
      // Keep the status text if the error body isn't JSON.
    }
    throw new CarpoolApiError(response.status, message)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : ({} as T)
}

export const carpoolApi = {
  get: <T>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: (url: string) => request<void>(url, { method: 'DELETE' }),
}

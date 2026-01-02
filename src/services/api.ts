/**
 * API service for communicating with Django backend.
 */

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Get CSRF token from cookie (set by Django)
 */
function getCsrfToken(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return null;
}

/**
 * Fetch wrapper that handles authentication and CSRF
 */
async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const { params, ...fetchOptions } = options;

  let fullUrl = `${API_BASE}${url}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    fullUrl += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Add CSRF token for mutating requests
  if (fetchOptions.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
  }

  const response = await fetch(fullUrl, {
    ...fetchOptions,
    credentials: 'include', // Send session cookie
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const errorText = await response.text();
    // Try to parse JSON error response to get a meaningful message
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      } else if (errorJson.detail) {
        errorMessage = errorJson.detail;
      }
    } catch {
      // Keep original text if not valid JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  return response;
}

export const api = {
  /**
   * GET request
   */
  get: async <T>(url: string, params?: Record<string, string>): Promise<T> => {
    const response = await fetchWithAuth(url, { method: 'GET', params });
    return response.json();
  },

  /**
   * POST request
   */
  post: async <T>(url: string, data?: unknown): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    // Handle empty responses (204 No Content)
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  },

  /**
   * PUT request
   */
  put: async <T>(url: string, data: unknown): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * PATCH request
   */
  patch: async <T>(url: string, data: unknown): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * DELETE request
   */
  delete: async <T = void>(url: string): Promise<T> => {
    const response = await fetchWithAuth(url, { method: 'DELETE' });
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  },
};

/**
 * Initialize CSRF token by making a request to get it
 */
export async function initCsrf(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/csrf/`, {
      credentials: 'include',
    });
  } catch (e) {
    console.warn('Failed to initialize CSRF token:', e);
  }
}

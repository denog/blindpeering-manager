/**
 * Authentication Hook
 *
 * Manages user authentication state including login, logout, and session persistence.
 * Uses Django session-based authentication with CSRF token protection.
 *
 * @example
 * const { user, isAuthenticated, signIn, signOut } = useAuth()
 *
 * // Check authentication
 * if (!isAuthenticated) redirect('/login')
 *
 * // Login
 * await signIn(username, password)
 *
 * // Logout
 * await signOut()
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, initCsrf, ApiError } from "@/services/api";
import { toast } from "@/hooks/use-toast";

/** Authenticated user information from Django */
interface User {
  id: number;
  email: string;
  username: string;
}

interface SessionResponse {
  authenticated: boolean;
  user: User | null;
}

type AuthErrorInfo = {
  message: string;
  timestamp: number;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const isMountedRef = useRef(true);

  const checkSession = useCallback(async () => {
    try {
      // Initialize CSRF token first
      await initCsrf();

      const session = await api.get<SessionResponse>('/auth/session/');
      if (!isMountedRef.current) return;

      setUser(session.user);
      setLoading(false);
    } catch (error) {
      if (!isMountedRef.current) return;
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void checkSession();

    return () => {
      isMountedRef.current = false;
    };
  }, [checkSession]);

  const signIn = async (username: string, password: string) => {
    setAuthError(null);
    setLoading(true);

    try {
      // Initialize CSRF token before login
      await initCsrf();

      const response = await api.post<{ user: User }>('/auth/login/', {
        username,
        password,
      });

      if (!isMountedRef.current) return;
      setUser(response.user);
      setLoading(false);
      return response.user;
    } catch (error) {
      if (!isMountedRef.current) return;
      setLoading(false);

      const message = error instanceof ApiError
        ? 'Invalid username or password'
        : 'An error occurred during login';

      setAuthError({
        message,
        timestamp: Date.now(),
      });

      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });

      throw error;
    }
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout/');
    } catch (error) {
      console.warn('Logout error:', error);
    }
    setUser(null);
  };

  return {
    /** Current authenticated user, or null if not logged in */
    user,
    /** True while checking session or during login/logout */
    loading,
    /** Error info from the last failed authentication attempt */
    authError,
    /** Authenticate with username and password */
    signIn,
    /** End the current session */
    signOut,
    /** Convenience boolean for checking auth status */
    isAuthenticated: !!user,
  };
}

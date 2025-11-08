import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../utils/api';

interface AuthContextType
{
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    teamCode?: string,
  ) => Promise<{ error?: string; success?: boolean; teamJoin?: any; }>;
  signIn: (email: string, password: string) => Promise<{ error?: string; }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean; }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string; success?: boolean; }>;
  isSessionValid: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () =>
{
  const context = useContext(AuthContext);
  if (!context)
  {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode; }> = ({ children }) =>
{
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() =>
  {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) =>
    {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) =>
    {
      console.log(`[${new Date().toISOString()}] Auth state change:`, event, session?.user?.email || 'no user');

      // Handle different auth events
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED')
      {
        setSession(session);
        setUser(session?.user ?? null);
      }
      else if (event === 'SIGNED_IN')
      {
        setSession(session);
        setUser(session?.user ?? null);
      }
      else
      {
        // For other events, still update the state
        setSession(session);
        setUser(session?.user ?? null);
      }

      setLoading(false);
    });

    return () =>
    {
      subscription.unsubscribe();
    };
  }, []);

  // Separate useEffect for session validation to avoid circular dependency
  useEffect(() =>
  {
    if (!session) return;

    // Periodic session validation check (every 10 minutes)
    const sessionCheckInterval = setInterval(async () =>
    {
      try
      {
        // Get the current session from Supabase to check for automatic refresh
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error)
        {
          console.warn('Error checking session:', error.message);
          return;
        }

        if (!currentSession)
        {
          console.log('No session found, clearing auth state');
          setSession(null);
          setUser(null);
          return;
        }

        // Check if session has actually expired (not just approaching expiration)
        if (!isSessionValid(currentSession))
        {
          console.log('Session has expired, attempting refresh...');

          // Try to refresh the session
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError || !refreshedSession)
          {
            console.log('Failed to refresh session, clearing auth state');
            setSession(null);
            setUser(null);
          }
          else
          {
            console.log('Session refreshed successfully');
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          }
        }
        else if (currentSession !== session)
        {
          // Update session if it has been refreshed by Supabase
          setSession(currentSession);
          setUser(currentSession.user);
        }
      }
      catch (error)
      {
        console.error('Error during session validation:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    return () => clearInterval(sessionCheckInterval);
  }, [session]);

  const signUp = async (email: string, password: string, name: string, teamCode?: string) =>
  {
    try
    {
      // Use backend API for signup to ensure user record is created properly
      const apiUrl = getApiUrl();
      const requestBody: any = { email, password, name };

      // Include team code if provided
      if (teamCode && teamCode.trim())
      {
        requestBody.teamCode = teamCode.trim();
      }

      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        return { error: errorData.error || 'Signup failed' };
      }

      await response.json();
      return {
        success: true,
      };
    }
    catch (error)
    {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string) =>
  {
    try
    {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error)
      {
        return { error: error.message };
      }

      return {};
    }
    catch (error)
    {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () =>
  {
    try
    {
      // Check if we have a valid session before attempting logout
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error || !currentSession || !isSessionValid())
      {
        // If no valid session or session is expired, just clear local state
        console.log('No valid session or session expired, clearing local auth state');
        setSession(null);
        setUser(null);
        return;
      }

      // If we have a valid session, attempt proper logout
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError)
      {
        // If logout fails (e.g., token expired), still clear local state
        console.warn('Logout failed, clearing local auth state:', signOutError.message);
        setSession(null);
        setUser(null);
      }
    }
    catch (error)
    {
      // If any error occurs, ensure we clear local state
      console.error('Error during logout:', error);
      setSession(null);
      setUser(null);
    }
  };

  const resetPassword = async (email: string) =>
  {
    try
    {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=password-reset`,
      });

      if (error)
      {
        return { error: error.message };
      }

      return { success: true };
    }
    catch (error)
    {
      return { error: 'An unexpected error occurred' };
    }
  };

  const updatePassword = async (newPassword: string) =>
  {
    try
    {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error)
      {
        return { error: error.message };
      }

      return { success: true };
    }
    catch (error)
    {
      return { error: 'An unexpected error occurred' };
    }
  };

  const isSessionValid = (sessionToCheck?: Session | null): boolean =>
  {
    const sessionObj = sessionToCheck || session;

    if (!sessionObj || !sessionObj.expires_at)
    {
      return false;
    }

    // Check if token has actually expired (not just approaching expiration)
    const expiresAt = sessionObj.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();

    // Add a small buffer (30 seconds) to account for network delays
    const bufferTime = 30 * 1000;

    return expiresAt > (now + bufferTime);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        isSessionValid,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

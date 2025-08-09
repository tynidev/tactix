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
      console.log('Auth state change:', event, session?.user?.email || 'no user');

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

    // Periodic session validation check (every 5 minutes)
    const sessionCheckInterval = setInterval(() =>
    {
      if (!isSessionValid())
      {
        console.log('Session expired, clearing auth state');
        setSession(null);
        setUser(null);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

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

  const isSessionValid = (): boolean =>
  {
    if (!session || !session.expires_at)
    {
      return false;
    }

    // Check if token expires within the next 5 minutes (300 seconds)
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);

    return expiresAt > fiveMinutesFromNow;
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
        isSessionValid,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

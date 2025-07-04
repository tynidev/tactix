import { supabase } from '../lib/supabase';

/**
 * Get the API base URL from environment variables with fallback
 */
export const getApiUrl = (): string =>
{
  // In production, prefer the environment variable
  // Fallback to the production API URL if not set
  return 'https://tactix-hls7.onrender.com';
};

/**
 * Get a valid access token, refreshing if necessary
 */
export const getValidAccessToken = async (): Promise<string | null> =>
{
  try
  {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session)
    {
      console.warn('No valid session found');
      return null;
    }

    // Check if token is close to expiring (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow)
    {
      // Token is expiring soon, try to refresh
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession)
      {
        console.warn('Failed to refresh token:', refreshError?.message);
        return null;
      }

      return refreshedSession.access_token;
    }

    return session.access_token;
  }
  catch (error)
  {
    console.error('Error getting access token:', error);
    return null;
  }
};

/**
 * Make an authenticated API request
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> =>
{
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Use provided token or get a fresh one
  const accessToken = token || await getValidAccessToken();

  if (accessToken)
  {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

import { supabase } from '../lib/supabase';

/**
 * API utilities for handling authentication, requests, and coaching point operations
 */

/**
 * Get the API base URL from environment variables with fallback
 */
export const getApiUrl = (): string =>
{
  // In Vite, use import.meta.env instead of process.env
  // Environment variables must be prefixed with VITE_ to be exposed to the client
  return import.meta.env.VITE_API_URL || 'https://tactix-hls7.onrender.com';
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
 * Record a view for a coaching point
 * @param pointId - ID of the coaching point
 * @param completionPercentage - Initial completion percentage (0-100)
 * @returns { eventId: string; viewCount: number }
 */
export const recordCoachingPointView = async (
  pointId: string,
  completionPercentage: number = 0,
): Promise<{ eventId: string; viewCount: number; }> =>
{
  try
  {
    const response = await apiRequest(`/api/coaching-points/${pointId}/view`, {
      method: 'POST',
      body: JSON.stringify({ completionPercentage }),
    });

    if (!response.ok)
    {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to record coaching point view');
    }

    return await response.json();
  }
  catch (error)
  {
    console.error('❌ Error recording coaching point view:', error);
    throw error;
  }
};

/**
 * Update the completion percentage for a specific view event
 * @param eventId - ID of the view event
 * @param completionPercentage - Percentage complete (0-100)
 */
export const updateViewCompletion = async (
  eventId: string,
  completionPercentage: number,
): Promise<void> =>
{
  try
  {
    const response = await apiRequest(`/api/coaching-points/view-events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completionPercentage }),
    });

    if (!response.ok)
    {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update view completion');
    }

    // Intentionally ignore response body; callers don't require it
    return;
  }
  catch (error)
  {
    console.error('❌ Error updating view completion:', error);
    throw error;
  }
};

export type UnviewedCoachingPoint = {
  id: string;
  game_id: string;
  title: string;
  feedback: string;
  timestamp: number;
  created_at: string;
};

/**
 * Get unviewed coaching points for the current user
 * If gameId is provided, returns unviewed points for that game; otherwise returns all
 */
export const getUnviewedCoachingPoints = async (
  gameId?: string,
): Promise<UnviewedCoachingPoint[]> =>
{
  try
  {
    const endpoint = gameId ?
      `/api/games/${gameId}/coaching-points/unviewed` :
      '/api/coaching-points/unviewed';

    const response = await apiRequest(endpoint, { method: 'GET' });

    if (!response.ok)
    {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch unviewed coaching points');
    }

    const data = await response.json();
    return Array.isArray(data) ? data as UnviewedCoachingPoint[] : [];
  }
  catch (error)
  {
    console.error('❌ Error fetching unviewed coaching points:', error);
    throw error;
  }
};

/**
 * Make an authenticated API request to the backend
 * @param endpoint - API endpoint path (with or without leading slash)
 * @param options - Fetch options (method, body, headers, etc.)
 * @param token - Optional access token (will get fresh token if not provided)
 * @returns Promise resolving to the fetch Response
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> =>
{
  const baseUrl = getApiUrl();
  // Normalize endpoint to ensure proper URL construction
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

/**
 * Upload audio file to Supabase storage bucket
 * @param audioBlob - The audio blob to upload
 * @returns Promise resolving to the public URL or null if failed
 */
export const uploadAudioFile = async (audioBlob: Blob): Promise<string | null> =>
{
  try
  {
    // Create a proper filename without special characters
    const timestamp = Date.now();
    // Extract just the main type (e.g., "webm" from "audio/webm;codecs=opus")
    const mimeTypeParts = audioBlob.type.split(';')[0]; // Remove codec info
    const fileExtension = mimeTypeParts.split('/')[1] || 'webm';
    const fileName = `coaching-point-${timestamp}.${fileExtension}`;

    // Create a new File object with the proper name and type
    const audioFile = new File([audioBlob], fileName, {
      type: mimeTypeParts, // Use cleaned mime type without codec info
    });

    const { data, error } = await supabase.storage
      .from('coaching-audio')
      .upload(fileName, audioFile, {
        cacheControl: '3600', // Cache for 1 hour
        upsert: false, // Don't overwrite existing files
      });

    if (error)
    {
      console.error('❌ Error uploading audio:', error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('coaching-audio')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }
  catch (error)
  {
    console.error('❌ Upload error:', error);
    return null;
  }
};

/**
 * Compress drawing data by reducing precision and removing redundant data
 * Helps reduce payload size for large drawing datasets
 */
// (drawings: any[]): any[] =>
// {
//   return drawings.map(drawing =>
//   {
//     if (drawing.points && Array.isArray(drawing.points))
//     {
//       // Reduce point precision to 2 decimal places
//       const compressedPoints = drawing.points.map((point: any) => ({
//         x: Math.round(point.x * 100) / 100,
//         y: Math.round(point.y * 100) / 100,
//       }));

//       // Remove consecutive duplicate points
//       const filteredPoints = compressedPoints.filter((point: any, index: number) =>
//       {
//         if (index === 0) return true;
//         const prevPoint = compressedPoints[index - 1];
//         return point.x !== prevPoint.x || point.y !== prevPoint.y;
//       });

//       return { ...drawing, points: filteredPoints };
//     }
//     return drawing;
//   });
// };

/**
 * Create a comprehensive coaching point with optional audio recording, events, player tags, and labels
 * This is the main function for creating coaching points with all associated data
 *
 * @param gameId - ID of the game this coaching point belongs to
 * @param title - Title/name of the coaching point
 * @param feedback - Detailed feedback text
 * @param timestamp - Video timestamp where this coaching point occurs
 * @param _drawingData - Drawing data (currently unused, reserved for future use)
 * @param selectedPlayers - Array of player IDs to tag with this coaching point
 * @param selectedLabels - Array of label IDs to associate with this coaching point
 * @param audioBlob - Optional audio recording blob
 * @param recordingEvents - Optional array of recording events (draws, plays, etc.)
 * @param recordingDuration - Optional duration of the recording in seconds
 * @returns Promise resolving to the created coaching point object
 */
export const createCoachingPointWithRecording = async (
  gameId: string,
  title: string,
  feedback: string,
  timestamp: number,
  _drawingData: any[], // Unused for now but kept for future use
  selectedPlayers: string[],
  selectedLabels: string[],
  audioBlob?: Blob,
  recordingEvents?: any[],
  recordingDuration?: number,
): Promise<any> =>
{
  try
  {
    let audioUrl = '';

    // Upload audio if provided
    if (audioBlob)
    {
      audioUrl = await uploadAudioFile(audioBlob) || '';
    }

    // Create the main coaching point record
    const coachingPointData = {
      game_id: gameId,
      title,
      feedback,
      timestamp,
      audio_url: audioUrl,
      duration: recordingDuration || 0,
    };

    const response = await apiRequest('/api/coaching-points', {
      method: 'POST',
      body: JSON.stringify(coachingPointData),
    });

    if (!response.ok)
    {
      const errorText = await response.text();
      console.error('❌ Failed to create coaching point:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error('Failed to create coaching point');
    }

    const coachingPoint = await response.json();

    // Create coaching point events if provided using batch endpoint for efficiency
    if (recordingEvents && recordingEvents.length > 0)
    {
      const eventsData = recordingEvents.map(event =>
      {
        const eventData = {
          point_id: coachingPoint.id,
          event_type: event.type,
          timestamp: event.timestamp,
          event_data: event.data,
        };

        // Compress drawing data if present
        if (event.type === 'draw' && event.data?.drawings)
        {
          return {
            point_id: coachingPoint.id,
            event_type: event.type,
            timestamp: event.timestamp,
            event_data: {
              ...event.data,
              drawings: event.data.drawings,
              // drawings: compressDrawingData(event.data.drawings),
            },
          };
        }

        return eventData;
      });

      const batchResponse = await apiRequest('/api/coaching-point-events/batch', {
        method: 'POST',
        body: JSON.stringify({ events: eventsData }),
      });

      if (!batchResponse.ok)
      {
        const errorText = await batchResponse.text();
        console.error('❌ Failed to save recording events:', {
          status: batchResponse.status,
          statusText: batchResponse.statusText,
          error: errorText,
        });
        console.warn('⚠️ Recording events not saved, but coaching point was created');
      }
    }

    // Associate players with this coaching point (many-to-many relationship)
    if (selectedPlayers.length > 0)
    {
      const playerPromises = selectedPlayers.map(async (playerId, index) =>
      {
        try
        {
          const response = await apiRequest('/api/coaching-point-tagged-players', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              player_id: playerId,
            }),
          });

          return response;
        }
        catch (error)
        {
          console.error(`❌ Error tagging player ${index + 1}:`, error);
          throw error;
        }
      });

      await Promise.all(playerPromises);
    }

    // Associate labels with this coaching point (many-to-many relationship)
    if (selectedLabels.length > 0)
    {
      const labelPromises = selectedLabels.map(async (labelId) =>
      {
        try
        {
          const response = await apiRequest('/api/coaching-point-labels', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              label_id: labelId,
            }),
          });

          return response;
        }
        catch (error)
        {
          throw error;
        }
      });

      await Promise.all(labelPromises);
    }

    return coachingPoint;
  }
  catch (error)
  {
    console.error('❌ Error creating coaching point with recording:', error);
    throw error;
  }
};

/**
 * Update a player's jersey number
 * @param teamId - ID of the team
 * @param playerId - ID of the player
 * @param jerseyNumber - New jersey number (can be null to clear)
 * @returns Promise resolving to the updated player data
 */
export const updatePlayerJerseyNumber = async (
  teamId: string,
  playerId: string,
  jerseyNumber: string | null,
): Promise<any> =>
{
  try
  {
    const response = await apiRequest(`/api/teams/${teamId}/players/${playerId}/jersey-number`, {
      method: 'PUT',
      body: JSON.stringify({ jerseyNumber }),
    });

    if (!response.ok)
    {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update jersey number');
    }

    return await response.json();
  }
  catch (error)
  {
    console.error('❌ Error updating jersey number:', error);
    throw error;
  }
};

/**
 * Get acknowledgment for a coaching point (supports guardian proxy via playerId)
 * @param coachingPointId - ID of the coaching point
 * @param playerId - Optional player ID for guardian proxy acknowledgments
 * @returns Promise resolving to acknowledgment data
 */
export const getCoachingPointAcknowledgment = async (
  coachingPointId: string,
  playerId?: string,
): Promise<{ acknowledged: boolean; ack_at: string | null; notes: string | null; }> =>
{
  try
  {
    const url = playerId ?
      `/api/coaching-points/${coachingPointId}/acknowledgment?player_id=${playerId}` :
      `/api/coaching-points/${coachingPointId}/acknowledgment`;

    const response = await apiRequest(url);

    if (!response.ok)
    {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch acknowledgment');
    }

    return await response.json();
  }
  catch (error)
  {
    console.error('❌ Error fetching acknowledgment:', error);
    throw error;
  }
};

/**
 * Create or update acknowledgment for a coaching point (supports guardian proxy via playerId)
 * @param coachingPointId - ID of the coaching point
 * @param acknowledged - Whether the coaching point is acknowledged
 * @param notes - Optional notes about what was learned
 * @param playerId - Optional player ID for guardian proxy acknowledgments
 * @returns Promise resolving to updated acknowledgment data
 */
export const updateCoachingPointAcknowledgment = async (
  coachingPointId: string,
  acknowledged: boolean,
  notes?: string,
  playerId?: string,
): Promise<{ acknowledged: boolean; ack_at: string | null; notes: string | null; }> =>
{
  try
  {
    const requestBody: any = { acknowledged, notes };
    if (playerId)
    {
      requestBody.player_id = playerId;
    }

    const response = await apiRequest(`/api/coaching-points/${coachingPointId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok)
    {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update acknowledgment');
    }

    return await response.json();
  }
  catch (error)
  {
    console.error('❌ Error updating acknowledgment:', error);
    throw error;
  }
};

/**
 * Get players for a guardian in a specific team
 * @param teamId - ID of the team
 * @returns Promise resolving to array of guardian's players in the team
 */
export const getGuardianPlayers = async (
  teamId: string,
): Promise<{ id: string; name: string; jersey_number: string | null; }[]> =>
{
  try
  {
    const response = await apiRequest(`/api/players/guardian/team/${teamId}`);

    if (!response.ok)
    {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch guardian players');
    }

    return await response.json();
  }
  catch (error)
  {
    console.error('❌ Error fetching guardian players:', error);
    throw error;
  }
};

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
export const uploadAudioFile = async (audioBlob: Blob): Promise<string | null> => {
  try {
    // Create a proper filename without special characters
    const timestamp = Date.now();
    // Extract just the main type (e.g., "webm" from "audio/webm;codecs=opus")
    const mimeTypeParts = audioBlob.type.split(';')[0]; // Remove codec info
    const fileExtension = mimeTypeParts.split('/')[1] || 'webm';
    const fileName = `coaching-point-${timestamp}.${fileExtension}`;

    // Create a new File object with the proper name and type
    const audioFile = new File([audioBlob], fileName, {
      type: mimeTypeParts // Use cleaned mime type without codec info
    });

    const { data, error } = await supabase.storage
      .from('coaching-audio')
      .upload(fileName, audioFile, {
        cacheControl: '3600', // Cache for 1 hour
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      console.error('❌ Error uploading audio:', error);
      return null;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('coaching-audio')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Upload error:', error);
    return null;
  }
};

/**
 * Compress drawing data by reducing precision and removing redundant data
 * Helps reduce payload size for large drawing datasets
 */
const compressDrawingData = (drawings: any[]): any[] => {
  return drawings.map(drawing => {
    if (drawing.points && Array.isArray(drawing.points)) {
      // Reduce point precision to 2 decimal places
      const compressedPoints = drawing.points.map((point: any) => ({
        x: Math.round(point.x * 100) / 100,
        y: Math.round(point.y * 100) / 100
      }));
      
      // Remove consecutive duplicate points
      const filteredPoints = compressedPoints.filter((point: any, index: number) => {
        if (index === 0) return true;
        const prevPoint = compressedPoints[index - 1];
        return point.x !== prevPoint.x || point.y !== prevPoint.y;
      });
      
      return { ...drawing, points: filteredPoints };
    }
    return drawing;
  });
};

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
  recordingDuration?: number
): Promise<any> => {
  try {
    let audioUrl = '';
    
    // Upload audio if provided
    if (audioBlob) {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to create coaching point:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error('Failed to create coaching point');
    }

    const coachingPoint = await response.json();

    // Create coaching point events if provided using batch endpoint for efficiency
    if (recordingEvents && recordingEvents.length > 0) {
      const eventsData = recordingEvents.map(event => {
        // Compress drawing data if present
        if (event.type === 'draw' && event.data?.drawings) {
          return {
            point_id: coachingPoint.id,
            event_type: event.type,
            timestamp: event.timestamp,
            event_data: {
              ...event.data,
              drawings: compressDrawingData(event.data.drawings)
            },
          };
        }
        
        return {
          point_id: coachingPoint.id,
          event_type: event.type,
          timestamp: event.timestamp,
          event_data: event.data,
        };
      });

      const batchResponse = await apiRequest('/api/coaching-point-events/batch', {
        method: 'POST',
        body: JSON.stringify({ events: eventsData }),
      });

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.error('❌ Failed to save recording events:', {
          status: batchResponse.status,
          statusText: batchResponse.statusText,
          error: errorText
        });
        console.warn('⚠️ Recording events not saved, but coaching point was created');
      }
    }

    // Associate players with this coaching point (many-to-many relationship)
    if (selectedPlayers.length > 0) {
      const playerPromises = selectedPlayers.map(async (playerId, index) => {
        try {
          const response = await apiRequest('/api/coaching-point-tagged-players', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              player_id: playerId,
            }),
          });
                    
          return response;
        } catch (error) {
          console.error(`❌ Error tagging player ${index + 1}:`, error);
          throw error;
        }
      });

      await Promise.all(playerPromises);
    }

    // Associate labels with this coaching point (many-to-many relationship)
    if (selectedLabels.length > 0) {
      const labelPromises = selectedLabels.map(async (labelId) => {
        try {
          const response = await apiRequest('/api/coaching-point-labels', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              label_id: labelId,
            }),
          });
                    
          return response;
        } catch (error) {
          throw error;
        }
      });

      await Promise.all(labelPromises);
    }

    return coachingPoint;
  } catch (error) {
    console.error('❌ Error creating coaching point with recording:', error);
    throw error;
  }
};

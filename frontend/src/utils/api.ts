import { supabase } from '../lib/supabase';

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

/**
 * Upload audio file to Supabase storage
 */
export const uploadAudioFile = async (audioBlob: Blob, fileName: string): Promise<string | null> => {
  console.log('🎵 Starting audio upload:', {
    fileName,
    blobSize: audioBlob.size,
    blobType: audioBlob.type,
    timestamp: new Date().toISOString()
  });

  try {
    const { data, error } = await supabase.storage
      .from('coaching-audio')
      .upload(fileName, audioBlob, {
        contentType: audioBlob.type,
        upsert: false
      });

    if (error) {
      console.error('❌ Error uploading audio:', error);
      return null;
    }

    console.log('✅ Audio upload successful:', {
      path: data.path,
      fullPath: data.fullPath,
      id: data.id
    });

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('coaching-audio')
      .getPublicUrl(data.path);

    console.log('🔗 Generated public URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error uploading audio file:', error);
    return null;
  }
};

/**
 * Create coaching point with audio and events
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
  console.log('🚀 Starting coaching point creation with recording:', {
    gameId,
    title,
    hasAudio: !!audioBlob,
    audioSize: audioBlob?.size,
    eventCount: recordingEvents?.length || 0,
    recordingDuration,
    playerCount: selectedPlayers.length,
    labelCount: selectedLabels.length,
    timestamp: new Date().toISOString()
  });

  try {
    let audioUrl = '';
    
    // Upload audio if provided
    if (audioBlob) {
      console.log('📁 Uploading audio file...');
      const fileName = `coaching-point-${Date.now()}.${audioBlob.type.split('/')[1] || 'webm'}`;
      audioUrl = await uploadAudioFile(audioBlob, fileName) || '';
      
      if (audioUrl) {
        console.log('✅ Audio upload completed, URL:', audioUrl);
      } else {
        console.warn('⚠️ Audio upload failed, proceeding without audio');
      }
    } else {
      console.log('ℹ️ No audio blob provided, skipping audio upload');
    }

    // Create coaching point
    console.log('📝 Creating coaching point...');
    const coachingPointData = {
      game_id: gameId,
      title,
      feedback,
      timestamp,
      audio_url: audioUrl,
      duration: recordingDuration || 0,
    };
    console.log('📊 Coaching point data:', coachingPointData);

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
    console.log('✅ Coaching point created successfully:', {
      id: coachingPoint.id,
      title: coachingPoint.title,
      audioUrl: coachingPoint.audio_url,
      duration: coachingPoint.duration
    });

    // Create coaching point events if provided using batch endpoint
    if (recordingEvents && recordingEvents.length > 0) {
      console.log(`📹 Creating ${recordingEvents.length} recording events...`);
      
      const eventsData = recordingEvents.map(event => ({
        point_id: coachingPoint.id,
        event_type: event.type,
        timestamp: event.timestamp,
        event_data: event.data,
      }));

      console.log('📋 Events data sample:', eventsData.slice(0, 3)); // Log first 3 events

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
      } else {
        const createdEvents = await batchResponse.json();
        console.log('✅ Recording events created successfully:', {
          count: createdEvents.length,
          types: [...new Set(createdEvents.map((e: any) => e.event_type))]
        });
      }
    } else {
      console.log('ℹ️ No recording events to save');
    }

    // Tag players if any selected
    if (selectedPlayers.length > 0) {
      console.log(`👥 Tagging ${selectedPlayers.length} players...`);
      
      const playerPromises = selectedPlayers.map(async (playerId, index) => {
        try {
          const response = await apiRequest('/api/coaching-point-tagged-players', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              player_id: playerId,
            }),
          });
          
          if (response.ok) {
            console.log(`✅ Player ${index + 1}/${selectedPlayers.length} tagged successfully`);
          } else {
            console.warn(`⚠️ Failed to tag player ${index + 1}/${selectedPlayers.length}:`, playerId);
          }
          
          return response;
        } catch (error) {
          console.error(`❌ Error tagging player ${index + 1}:`, error);
          throw error;
        }
      });

      await Promise.all(playerPromises);
      console.log('✅ All players tagged successfully');
    } else {
      console.log('ℹ️ No players to tag');
    }

    // Add labels if any selected
    if (selectedLabels.length > 0) {
      console.log(`🏷️ Adding ${selectedLabels.length} labels...`);
      
      const labelPromises = selectedLabels.map(async (labelId, index) => {
        try {
          const response = await apiRequest('/api/coaching-point-labels', {
            method: 'POST',
            body: JSON.stringify({
              point_id: coachingPoint.id,
              label_id: labelId,
            }),
          });
          
          if (response.ok) {
            console.log(`✅ Label ${index + 1}/${selectedLabels.length} added successfully`);
          } else {
            console.warn(`⚠️ Failed to add label ${index + 1}/${selectedLabels.length}:`, labelId);
          }
          
          return response;
        } catch (error) {
          console.error(`❌ Error adding label ${index + 1}:`, error);
          throw error;
        }
      });

      await Promise.all(labelPromises);
      console.log('✅ All labels added successfully');
    } else {
      console.log('ℹ️ No labels to add');
    }

    console.log('🎉 Coaching point with recording created successfully!', {
      id: coachingPoint.id,
      title: coachingPoint.title,
      hasAudio: !!audioUrl,
      eventCount: recordingEvents?.length || 0,
      playerCount: selectedPlayers.length,
      labelCount: selectedLabels.length,
      completedAt: new Date().toISOString()
    });

    return coachingPoint;
  } catch (error) {
    console.error('❌ Error creating coaching point with recording:', error);
    throw error;
  }
};

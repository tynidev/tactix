import { useCallback, useEffect, useRef, useState } from 'react';
import type { Drawing, RecordingStartEventData } from '../types/drawing';

export interface CoachingPointEvent
{
  id: string;
  event_type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed' | 'recording_start';
  timestamp: number;
  event_data: any;
  created_at: string;
}

export interface CoachingPointWithEvents
{
  id: string;
  game_id: string;
  author_id: string;
  title: string;
  feedback: string;
  timestamp: string;
  audio_url: string;
  duration: number;
  created_at: string;
  coaching_point_events?: CoachingPointEvent[];
}

export interface PlaybackEventHandlers
{
  onPlayEvent?: () => void;
  onPauseEvent?: () => void;
  onSeekEvent?: (time: number) => void;
  onDrawEvent?: (drawings: Drawing[]) => void;
  onSpeedEvent?: (speed: number) => void;
  onRecordingStartEvent?: (initialState: RecordingStartEventData) => void;
  onPlaybackComplete?: (reason: 'natural' | 'manual', currentProgress: number) => void;
}

export interface UseCoachingPointPlaybackReturn
{
  // State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number; // 0-100
  isLoading: boolean;
  error: string | null;
  activeEventIndex: number | null;
  totalEvents: number;

  // Controls
  startPlayback: (coachingPoint: CoachingPointWithEvents, handlers?: PlaybackEventHandlers) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  stopPlayback: () => void;
  seekTo: (time: number) => void;
}

/**
 * Custom hook for managing coaching point playback with synchronized events
 * Handles audio playback and executes recorded events at precise timestamps
 */
export const useCoachingPointPlayback = (): UseCoachingPointPlaybackReturn =>
{
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eventsRef = useRef<CoachingPointEvent[]>([]);
  const handlersRef = useRef<PlaybackEventHandlers>({});
  const animationFrameRef = useRef<number | null>(null);
  const executedEventsRef = useRef<Set<string>>(new Set());
  const isCleaningUpRef = useRef<boolean>(false);

  /**
   * Processes events that should be executed at the current audio time
   */
  const processEvents = useCallback(() =>
  {
    if (!audioRef.current || eventsRef.current.length === 0)
    {
      return;
    }

    const audioTime = audioRef.current.currentTime * 1000; // Convert to milliseconds
    const tolerance = 100; // 100ms tolerance for event execution

    eventsRef.current.forEach((event, index) =>
    {
      const eventId = event.id;

      // Skip if already executed
      if (executedEventsRef.current.has(eventId)) return;

      const timeDiff = Math.abs(audioTime - event.timestamp);

      // Check if event should be executed now
      if (timeDiff <= tolerance)
      {
        // Mark as executed
        executedEventsRef.current.add(eventId);
        setActiveEventIndex(index);

        // Execute event based on type
        try
        {
          switch (event.event_type)
          {
            case 'play':
              handlersRef.current.onPlayEvent?.();
              break;
            case 'pause':
              handlersRef.current.onPauseEvent?.();
              break;
            case 'seek':
              if (event.event_data?.toTime !== undefined)
              {
                handlersRef.current.onSeekEvent?.(event.event_data.toTime);
              }
              break;
            case 'draw':
              if (event.event_data?.drawings !== undefined)
              {
                // Handle both non-empty drawings and empty arrays (canvas clear)
                handlersRef.current.onDrawEvent?.(event.event_data.drawings);
              }
              break;
            case 'change_speed':
              if (event.event_data?.speed !== undefined)
              {
                handlersRef.current.onSpeedEvent?.(event.event_data.speed);
              }
              break;
            case 'recording_start':
              if (event.event_data)
              {
                handlersRef.current.onRecordingStartEvent?.(event.event_data as RecordingStartEventData);
              }
              break;
          }
        }
        catch (err)
        {
          console.error(`❌ Error executing event ${event.event_type}:`, err);
        }

        // Clear active event after a brief delay
        setTimeout(() =>
        {
          setActiveEventIndex(null);
        }, 500);
      }
    });
  }, []);

  // Store duration in a ref so it can be accessed in the animation loop without dependencies
  const durationRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);

  // Update duration ref when duration state changes
  useEffect(() =>
  {
    durationRef.current = duration;
  }, [duration]);

  /**
   * Animation frame loop for checking events and updating progress
   */
  const animationLoop = useCallback(() =>
  {
    if (!audioRef.current)
    {
      return;
    }

    const audio = audioRef.current;
    const time = audio.currentTime;
    let dur = audio.duration || 0;

    // Use state duration if audio duration is invalid (Infinity, NaN, or 0)
    if (!isFinite(dur) || dur === 0)
    {
      dur = durationRef.current;
    }

    // Throttle UI updates to ~10Hz instead of 60Hz to improve React rendering performance
    const now = Date.now();
    if (now - lastUpdateTimeRef.current >= 100)
    { // Update every 100ms
      setCurrentTime(time);
      setProgress(dur > 0 ? (time / dur) * 100 : 0);
      lastUpdateTimeRef.current = now;
    }

    // Process events at current time - use audio state instead of isPlaying state
    if (!audio.paused && (!audio.ended || !isFinite(audio.duration)))
    {
      processEvents();
    }

    // Continue loop based on audio state, not React state - modified condition to handle Infinity duration
    if (!audio.paused && (!audio.ended || !isFinite(audio.duration)))
    {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    }
  }, [processEvents]);

  /**
   * Internal cleanup function that doesn't call completion handler
   */
  const cleanupPlayback = useCallback(() =>
  {
    if (audioRef.current)
    {
      const audio = audioRef.current;

      // Set cleanup flag to ignore error events during cleanup
      isCleaningUpRef.current = true;

      // Pause the audio first
      audio.pause();

      // Clear the source safely without triggering errors
      audio.removeAttribute('src');
      audio.load(); // Reset the audio element

      audioRef.current = null;
      isCleaningUpRef.current = false;
    }

    if (animationFrameRef.current)
    {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
    setIsLoading(false);
    setError(null);
    setActiveEventIndex(null);
    setTotalEvents(0);

    // Clear refs
    eventsRef.current = [];
    handlersRef.current = {};
    executedEventsRef.current.clear();
  }, []);

  /**
   * Stops playback and cleans up
   */
  const stopPlayback = useCallback(() =>
  {
    // Get current progress before cleanup
    const currentProgress = progress;

    // Call completion handler before cleanup to notify parent component (e.g., to clear canvas)
    // Pass 'manual' reason since this is called by user action, not natural completion
    handlersRef.current.onPlaybackComplete?.('manual', currentProgress);

    // Clean up without dependencies
    cleanupPlayback();
  }, [progress, cleanupPlayback]);

  /**
   * Detects actual audio duration using Web Audio API when HTML Audio reports Infinity
   */
  const detectAudioDuration = useCallback(async (audioUrl: string): Promise<number | null> =>
  {
    try
    {
      // Create AudioContext for duration detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Fetch audio data
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();

      // Decode audio data to get duration
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const detectedDuration = audioBuffer.duration;

      // Clean up AudioContext
      await audioContext.close();

      return detectedDuration;
    }
    catch (error)
    {
      console.warn('Failed to detect audio duration via Web Audio API:', error);
      return null;
    }
  }, []);

  /**
   * Starts playback of a coaching point with its events
   */
  const startPlayback = useCallback((
    coachingPoint: CoachingPointWithEvents,
    handlers: PlaybackEventHandlers = {},
  ) =>
  {
    // Clean up any current playback without triggering completion handler
    cleanupPlayback();

    // Validate audio URL
    if (!coachingPoint.audio_url)
    {
      setError('No audio available for this coaching point');
      return;
    }

    setError(null);
    setIsLoading(true);

    // Store event handlers
    handlersRef.current = handlers;

    // Immediately set duration from database as fallback (will be overridden if audio provides valid duration)
    const fallbackDuration = coachingPoint.duration / 1000; // Convert ms to seconds
    setDuration(fallbackDuration);

    // Sort and store events by timestamp
    const events = (coachingPoint.coaching_point_events || []).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    eventsRef.current = events;
    setTotalEvents(events.length);

    // Reset execution tracking
    executedEventsRef.current.clear();
    setActiveEventIndex(null);

    // Check for recording_start event and execute it immediately to set initial state
    const recordingStartEvent = events.find(event => event.event_type === 'recording_start');
    if (recordingStartEvent && handlers.onRecordingStartEvent)
    {
      try
      {
        handlers.onRecordingStartEvent(recordingStartEvent.event_data as RecordingStartEventData);
        // Mark as executed so it doesn't trigger again during playback
        executedEventsRef.current.add(recordingStartEvent.id);
      }
      catch (err)
      {
        console.error('❌ Error executing recording_start event:', err);
      }
    }

    // Create and configure audio element
    const audio = new Audio(coachingPoint.audio_url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', async () =>
    {
      // Handle Infinity duration by using database duration as fallback
      let actualDuration = audio.duration;

      if (!isFinite(audio.duration) || audio.duration === 0)
      {
        // Try to detect duration using Web Audio API
        const detectedDuration = await detectAudioDuration(coachingPoint.audio_url);
        if (detectedDuration && isFinite(detectedDuration))
        {
          actualDuration = detectedDuration;
        }
        else
        {
          // Fall back to database duration
          actualDuration = coachingPoint.duration / 1000; // Convert ms to seconds
        }
      }

      setDuration(actualDuration);
      setIsLoading(false);
    });

    // Add additional fallback for duration setting
    audio.addEventListener('canplaythrough', async () =>
    {
      // Secondary check for duration if it wasn't set in loadedmetadata
      if (durationRef.current === 0)
      {
        let actualDuration = audio.duration;

        if (!isFinite(audio.duration) || audio.duration === 0)
        {
          // Try Web Audio API detection
          const detectedDuration = await detectAudioDuration(coachingPoint.audio_url);
          if (detectedDuration && isFinite(detectedDuration))
          {
            actualDuration = detectedDuration;
          }
          else
          {
            // Fall back to database duration
            actualDuration = coachingPoint.duration / 1000; // Convert ms to seconds
          }
        }

        if (actualDuration > 0)
        {
          setDuration(actualDuration);
        }
      }
    });

    audio.addEventListener('play', () =>
    {
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    });

    audio.addEventListener('pause', () =>
    {
      setIsPlaying(false);
      if (animationFrameRef.current)
      {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    });

    audio.addEventListener('ended', () =>
    {
      // Natural completion - audio finished playing
      handlersRef.current.onPlaybackComplete?.('natural', 100);

      // Clean up without calling the completion handler again
      if (audioRef.current)
      {
        const audio = audioRef.current;
        isCleaningUpRef.current = true;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audioRef.current = null;
        isCleaningUpRef.current = false;
      }

      if (animationFrameRef.current)
      {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Reset state
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setProgress(0);
      setIsLoading(false);
      setError(null);
      setActiveEventIndex(null);
      setTotalEvents(0);

      // Clear refs
      eventsRef.current = [];
      handlersRef.current = {};
      executedEventsRef.current.clear();
    });

    audio.addEventListener('error', (e) =>
    {
      // Ignore errors during cleanup to prevent spurious error messages
      if (isCleaningUpRef.current)
      {
        return;
      }

      console.error('❌ Audio error event:', e);
      console.error('❌ Audio error details:', {
        error: audio.error,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src,
      });
      setError('Failed to load audio. Please check the audio URL.');
      setIsLoading(false);
      setIsPlaying(false);
    });

    // Start playing
    audio.play().catch(err =>
    {
      console.error('❌ Failed to start playback:', err);
      setError('Failed to start playback. Please try again.');
      setIsLoading(false);
    });
  }, [animationLoop, cleanupPlayback, detectAudioDuration]);

  /**
   * Pauses playback
   */
  const pausePlayback = useCallback(() =>
  {
    if (audioRef.current && !audioRef.current.paused)
    {
      audioRef.current.pause();
    }
  }, []);

  /**
   * Resumes playback
   */
  const resumePlayback = useCallback(() =>
  {
    if (audioRef.current && audioRef.current.paused)
    {
      audioRef.current.play().catch(err =>
      {
        console.error('❌ Failed to resume playback:', err);
        setError('Failed to resume playback. Please try again.');
      });
    }
  }, []);

  /**
   * Seeks to a specific time in the audio
   */
  const seekTo = useCallback((time: number) =>
  {
    if (audioRef.current)
    {
      // Use fallback duration if audio duration is invalid
      let maxTime = audioRef.current.duration;
      if (!isFinite(maxTime) || maxTime === 0)
      {
        maxTime = duration;
      }

      audioRef.current.currentTime = Math.max(0, Math.min(time, maxTime || 0));

      // Reset executed events for events after the seek time
      const seekTimeMs = time * 1000;
      const eventsToReset = eventsRef.current.filter(event => event.timestamp > seekTimeMs);
      eventsToReset.forEach(event =>
      {
        executedEventsRef.current.delete(event.id);
      });
    }
  }, [duration]);

  // Cleanup on unmount
  useEffect(() =>
  {
    return () =>
    {
      cleanupPlayback();
    };
  }, [cleanupPlayback]);

  return {
    isPlaying,
    currentTime,
    duration,
    progress,
    isLoading,
    error,
    activeEventIndex,
    totalEvents,
    startPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    seekTo,
  };
};

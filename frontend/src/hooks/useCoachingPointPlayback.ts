import { useCallback, useEffect, useRef, useState } from 'react';
import type { Drawing } from '../types/drawing';

export interface CoachingPointEvent
{
  id: string;
  event_type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed';
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

  /**
   * Processes events that should be executed at the current audio time
   */
  const processEvents = useCallback(() =>
  {
    if (!audioRef.current || eventsRef.current.length === 0)
    {
      console.log('🔍 processEvents: Early return - no audio or no events');
      return;
    }

    const audioTime = audioRef.current.currentTime * 1000; // Convert to milliseconds
    const tolerance = 100; // 100ms tolerance for event execution

    // DEBUG: Log timing info every few calls to avoid spam
    if (Math.floor(audioTime / 1000) % 5 === 0 && audioTime % 1000 < 200)
    {
      console.log('🔍 processEvents called:', {
        audioCurrentTime: audioRef.current.currentTime,
        audioTimeMs: audioTime,
        totalEvents: eventsRef.current.length,
        nextEventTimestamp: eventsRef.current.find(e => !executedEventsRef.current.has(e.id))?.timestamp,
      });
    }

    eventsRef.current.forEach((event, index) =>
    {
      const eventId = event.id;

      // Skip if already executed
      if (executedEventsRef.current.has(eventId)) return;

      const timeDiff = Math.abs(audioTime - event.timestamp);

      // DEBUG: Log timing for events that are close
      if (timeDiff < 500)
      {
        console.log(
          `🔍 Event timing check: ${event.event_type} at ${event.timestamp}ms, audio at ${audioTime}ms, diff: ${timeDiff}ms`,
        );
      }

      // Check if event should be executed now
      if (timeDiff <= tolerance)
      {
        console.log(`🎬 Executing event: ${event.event_type} at ${event.timestamp}ms (audio: ${audioTime}ms)`);

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

  /**
   * Animation frame loop for checking events and updating progress
   */
  const animationLoop = useCallback(() =>
  {
    if (!audioRef.current)
    {
      console.log('🔍 animationLoop: No audio ref');
      return;
    }

    const audio = audioRef.current;
    const time = audio.currentTime;
    let dur = audio.duration || 0;

    // Use state duration if audio duration is invalid (Infinity, NaN, or 0)
    if (!isFinite(dur) || dur === 0)
    {
      dur = duration;
    }

    // Removed verbose debug logging now that feature is working

    setCurrentTime(time);
    setProgress(dur > 0 ? (time / dur) * 100 : 0);

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
    else
    {
      console.log('🔍 animationLoop stopping:', {
        isPlaying,
        paused: audio.paused,
        ended: audio.ended,
        duration: audio.duration,
        networkState: audio.networkState,
        readyState: audio.readyState,
      });
    }
  }, [isPlaying, processEvents, duration]);

  /**
   * Stops playback and cleans up
   */
  const stopPlayback = useCallback(() =>
  {
    console.log('🛑 Stopping playback');

    if (audioRef.current)
    {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
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
   * Starts playback of a coaching point with its events
   */
  const startPlayback = useCallback((
    coachingPoint: CoachingPointWithEvents,
    handlers: PlaybackEventHandlers = {},
  ) =>
  {
    // Stop any current playback
    stopPlayback();

    // DEBUG: Log coaching point data
    console.log('🔍 Coaching point data:', coachingPoint);
    console.log('🔍 Events array:', coachingPoint.coaching_point_events);
    console.log('🔍 Events length:', coachingPoint.coaching_point_events?.length || 0);
    console.log('🔍 Coaching point ID:', coachingPoint.id);
    console.log('🔍 Audio URL:', coachingPoint.audio_url);

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

    // Sort and store events by timestamp
    const events = (coachingPoint.coaching_point_events || []).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    eventsRef.current = events;
    setTotalEvents(events.length);

    // Reset execution tracking
    executedEventsRef.current.clear();
    setActiveEventIndex(null);

    console.log(`🎵 Starting playback with ${events.length} events`);

    // DEBUG: Log individual events if they exist
    if (events.length > 0)
    {
      console.log(
        '🔍 Individual events:',
        events.map(e => ({
          id: e.id,
          type: e.event_type,
          timestamp: e.timestamp,
          data: e.event_data,
        })),
      );
    }
    else
    {
      console.log('🔍 No events found - checking raw data structure...');
      console.log('🔍 Raw coaching_point_events:', JSON.stringify(coachingPoint.coaching_point_events, null, 2));
    }

    // Create and configure audio element
    const audio = new Audio(coachingPoint.audio_url);
    audioRef.current = audio;

    console.log('🔍 Created audio element, initial duration:', audio.duration);

    // Audio event listeners
    audio.addEventListener('loadstart', () =>
    {
      console.log('🎵 Audio loadstart event');
    });

    audio.addEventListener('loadedmetadata', () =>
    {
      console.log('🎵 Audio loadedmetadata event');
      console.log('🔍 Audio duration:', audio.duration);
      console.log('🔍 Audio readyState:', audio.readyState);

      // Handle Infinity duration by using database duration as fallback
      let actualDuration = audio.duration;
      if (!isFinite(audio.duration) || audio.duration === 0)
      {
        actualDuration = coachingPoint.duration / 1000; // Convert ms to seconds
        console.log('🔧 Using fallback duration from database:', actualDuration, 'seconds');
      }

      setDuration(actualDuration);
      setIsLoading(false);
      console.log(`🎵 Audio loaded: ${actualDuration}s duration`);
    });

    audio.addEventListener('loadeddata', () =>
    {
      console.log('🎵 Audio loadeddata event');
    });

    audio.addEventListener('canplay', () =>
    {
      console.log('🎵 Audio canplay event');
    });

    audio.addEventListener('canplaythrough', () =>
    {
      console.log('🎵 Audio canplaythrough event');
      setIsLoading(false);
    });

    audio.addEventListener('play', () =>
    {
      console.log('🎵 Audio play event');
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    });

    audio.addEventListener('pause', () =>
    {
      console.log('🎵 Audio pause event');
      setIsPlaying(false);
      if (animationFrameRef.current)
      {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    });

    audio.addEventListener('ended', () =>
    {
      console.log('🎵 Audio ended event');
      setIsPlaying(false);
      setProgress(100);
      setActiveEventIndex(null);
      if (animationFrameRef.current)
      {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      console.log('🎵 Playback ended');
    });

    audio.addEventListener('error', (e) =>
    {
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

    audio.addEventListener('timeupdate', () =>
    {
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0)
      {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    });

    console.log('🔍 About to call audio.play()');
    // Start playing
    audio.play().catch(err =>
    {
      console.error('❌ Failed to start playback:', err);
      setError('Failed to start playback. Please try again.');
      setIsLoading(false);
    });
  }, [animationLoop, stopPlayback]);

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
      stopPlayback();
    };
  }, [stopPlayback]);

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

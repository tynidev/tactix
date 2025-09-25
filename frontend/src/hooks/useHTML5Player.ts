import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPlayerState } from '../types/videoPlayer';

/**
 * Custom hook for managing HTML5 video player functionality
 * Provides comprehensive control over HTML5 video playback, dimensions tracking,
 * and player state management with keyboard shortcuts and API integration.
 *
 * @param videoUrl - The URL of the video to play
 * @returns Object containing player state, dimensions, and control functions
 */
export const useHTML5Player = (videoUrl: string) =>
{
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState<
    { width: number; height: number; top: number; left: number; } | null
  >(null);
  const [error, setError] = useState<string | undefined>(undefined);
  // Track whether we've already performed the initial auto-play. This prevents
  // subsequent `canplay` events (triggered by seeks) from restarting playback
  // after the user intentionally paused the video (e.g. when opening a static coaching point).
  const hasAutoPlayedRef = useRef(false);

  /**
   * Updates the video dimensions state based on the current video element size
   * Calculates the actual video area within the video container,
   * accounting for letterboxing/pillarboxing based on aspect ratios
   */
  const updateVideoDimensions = useCallback(() =>
  {
    if (!videoRef.current || !isReady) return;

    try
    {
      const video = videoRef.current;
      const containerRect = video.getBoundingClientRect();

      // Get the actual video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth === 0 || videoHeight === 0) return;

      const videoAspectRatio = videoWidth / videoHeight;
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const containerAspectRatio = containerWidth / containerHeight;

      let actualWidth, actualHeight, offsetTop, offsetLeft;

      if (containerAspectRatio > videoAspectRatio)
      {
        // Container is wider than video - black bars on sides
        actualHeight = containerHeight;
        actualWidth = containerHeight * videoAspectRatio;
        offsetTop = containerRect.top;
        offsetLeft = containerRect.left + (containerWidth - actualWidth) / 2;
      }
      else
      {
        // Container is taller than video - black bars on top/bottom
        actualWidth = containerWidth;
        actualHeight = containerWidth / videoAspectRatio;
        offsetLeft = containerRect.left;
        offsetTop = containerRect.top + (containerHeight - actualHeight) / 2;
      }

      setVideoDimensions({
        width: actualWidth,
        height: actualHeight,
        top: offsetTop,
        left: offsetLeft,
      });
    }
    catch (error)
    {
      console.error('Error updating video dimensions:', error);
    }
  }, [isReady]);

  /**
   * Updates the current time and duration from the video element
   * Called periodically to keep the time state in sync
   */
  const updateTimeState = useCallback(() =>
  {
    if (!videoRef.current || !isReady) return;

    try
    {
      const video = videoRef.current;
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    }
    catch (error)
    {
      console.error('Error updating time state:', error);
    }
  }, [isReady]);

  /**
   * Seeks to a specific time position in the video
   *
   * @param time - Time in seconds to seek to
   */
  const seekToTime = useCallback((time: number) =>
  {
    if (!videoRef.current) return;

    try
    {
      const video = videoRef.current;
      const newTime = Math.max(0, Math.min(video.duration || 0, time));
      video.currentTime = newTime;
    }
    catch (error)
    {
      console.error('Error seeking to time:', error);
    }
  }, []);

  /**
   * Initializes the video element and sets up event listeners
   */
  const initializePlayer = useCallback(() =>
  {
    const video = document.getElementById('html5-player') as HTMLVideoElement;
    if (!video) return;

    videoRef.current = video;

    // Set video source
    video.src = videoUrl;
    video.preload = 'metadata';

    // Set video attributes for optimal HUD integration
    video.controls = false; // Hide default controls for clean interface
    video.playsInline = true; // Play inline on mobile devices
    video.muted = true; // Start muted to allow autoplay

    const handleLoadedMetadata = () =>
    {
      setIsReady(true);
      setError(undefined);
      // Start tracking video dimensions after metadata is loaded
      setTimeout(updateVideoDimensions, 100);
      // Initialize time state
      setTimeout(updateTimeState, 200);
    };

    const handlePlay = () =>
    {
      setIsPlaying(true);
    };

    const handlePause = () =>
    {
      setIsPlaying(false);
    };

    const handleTimeUpdate = () =>
    {
      updateTimeState();
    };

    const handleError = () =>
    {
      const errorMessage = `Failed to load video: ${videoUrl}`;
      setError(errorMessage);
      console.error(errorMessage);
    };

    const handleCanPlay = () =>
    {
      // Auto-play only once (initial load). Do NOT auto-play again after seeks,
      // since selecting a static coaching point performs a seek and should leave
      // the video paused if the user paused it.
      if (!hasAutoPlayedRef.current)
      {
        try
        {
          video.play().catch(err =>
          {
            console.warn('Auto-play prevented:', err);
          });
        }
        catch (err)
        {
          console.warn('Auto-play failed:', err);
        }
        finally
        {
          hasAutoPlayedRef.current = true;
        }
      }
    };

    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);
    video.addEventListener('canplay', handleCanPlay);

    // Cleanup function
    return () =>
    {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoUrl, updateVideoDimensions, updateTimeState]);

  // Initialize player when component mounts or video URL changes
  useEffect(() =>
  {
    const cleanup = initializePlayer();
    return cleanup;
  }, [initializePlayer]);

  // Track video dimensions on resize and player state changes
  useEffect(() =>
  {
    if (!isReady) return;

    const handleResize = () =>
    {
      updateVideoDimensions();
    };

    window.addEventListener('resize', handleResize);

    // Update dimensions and time periodically to handle dynamic changes
    const interval = setInterval(() =>
    {
      updateVideoDimensions();
      updateTimeState();
    }, 250); // Update every 250ms for smooth timeline

    return () =>
    {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [isReady, updateVideoDimensions, updateTimeState]);

  /**
   * Toggles video playback between play and pause states
   * Checks current player state and switches to the opposite state
   */
  const togglePlayPause = useCallback(() =>
  {
    if (!videoRef.current) return;

    try
    {
      const video = videoRef.current;
      if (video.paused)
      {
        video.play();
      }
      else
      {
        video.pause();
      }
    }
    catch (error)
    {
      console.error('Error toggling play/pause:', error);
    }
  }, []);

  /**
   * Seeks the video forward or backward by a specified number of seconds
   * Ensures the new position stays within the video's duration bounds
   *
   * @param seconds - Number of seconds to seek (positive for forward, negative for backward)
   */
  const seekVideo = useCallback((seconds: number) =>
  {
    if (!videoRef.current) return;

    try
    {
      const video = videoRef.current;
      const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
      video.currentTime = newTime;
    }
    catch (error)
    {
      console.error('Error seeking video:', error);
    }
  }, []);

  /**
   * Sets the video playback rate (speed)
   * Common rates: 0.25, 0.5, 1, 1.25, 1.5, 2
   *
   * @param rate - Playback rate multiplier (1 = normal speed)
   */
  const setPlaybackRate = useCallback((rate: number) =>
  {
    if (!videoRef.current) return;

    try
    {
      videoRef.current.playbackRate = rate;
    }
    catch (error)
    {
      console.error('Error setting playback rate:', error);
    }
  }, []);

  /**
   * Gets the current playback time in seconds
   * Wrapper around the HTML5 video currentTime property
   *
   * @returns Current time in seconds
   */
  const getCurrentTime = useCallback(() =>
  {
    if (!videoRef.current) return 0;

    try
    {
      return videoRef.current.currentTime;
    }
    catch (error)
    {
      console.error('Error getting current time:', error);
      return 0;
    }
  }, []);

  /**
   * Gets the current player state
   * Returns HTML5 video state mapped to VideoPlayerState constants:
   * -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
   *
   * @returns Player state number
   */
  const getPlayerState = useCallback(() =>
  {
    if (!videoRef.current) return VideoPlayerState.UNSTARTED;

    try
    {
      const video = videoRef.current;

      if (video.ended) return VideoPlayerState.ENDED;
      if (!video.paused && !video.ended) return VideoPlayerState.PLAYING;
      if (video.paused && video.currentTime > 0) return VideoPlayerState.PAUSED;
      if (video.readyState >= 2) return VideoPlayerState.CUED;

      return VideoPlayerState.BUFFERING;
    }
    catch (error)
    {
      console.error('Error getting player state:', error);
      return VideoPlayerState.UNSTARTED;
    }
  }, []);

  /**
   * Gets the current playback rate
   * Wrapper around the HTML5 video playbackRate property
   *
   * @returns Current playback rate (1 = normal speed)
   */
  const getPlaybackRate = useCallback(() =>
  {
    if (!videoRef.current || !isReady) return 1;

    try
    {
      return videoRef.current.playbackRate;
    }
    catch (error)
    {
      console.error('Error getting playback rate:', error);
      return 1;
    }
  }, [isReady]);

  /**
   * Pauses the video playback
   * Wrapper around the HTML5 video pause method
   */
  const pauseVideo = useCallback(() =>
  {
    if (!videoRef.current) return;

    try
    {
      videoRef.current.pause();
    }
    catch (error)
    {
      console.error(`[HTML5Player] Error pausing video:`, error);
    }
  }, []);

  /**
   * Starts or resumes video playback
   * Wrapper around the HTML5 video play method
   */
  const playVideo = useCallback(() =>
  {
    if (!videoRef.current) return;

    try
    {
      videoRef.current.play().catch(err =>
      {
        console.error(`[HTML5Player] Error playing video:`, err);
      });
    }
    catch (error)
    {
      console.error(`[HTML5Player] Error playing video:`, error);
    }
  }, []);

  /**
   * Seeks to a specific time position in the video
   * Wrapper around the HTML5 video currentTime property
   *
   * @param time - Time in seconds to seek to
   */
  const seekTo = useCallback((time: number) =>
  {
    if (!videoRef.current) return;

    try
    {
      videoRef.current.currentTime = time;
    }
    catch (error)
    {
      console.error(`[HTML5Player] Error seeking to time:`, error);
    }
  }, []);

  useEffect(() =>
  {
    return () =>
    {
      // Clean up video element on unmount
      if (videoRef.current)
      {
        try
        {
          videoRef.current.pause();
          videoRef.current.src = '';
          videoRef.current.load();
        }
        catch (error)
        {
          console.error('Error cleaning up HTML5 video player:', error);
        }
        videoRef.current = null;
      }
    };
  }, []);

  return {
    isPlaying,
    isReady,
    currentTime,
    duration,
    videoType: 'html5' as const,
    videoDimensions,
    togglePlayPause,
    seekVideo,
    seekToTime,
    setPlaybackRate,
    updateVideoDimensions,
    getCurrentTime,
    getPlayerState,
    getPlaybackRate,
    pauseVideo,
    playVideo,
    seekTo,
    error,
  };
};

import { useEffect, useState, useCallback } from 'react';
import type { Player, PlayerEvent } from '../types/youtube';
import { CONFIG } from '../types/config';

/**
 * Custom hook for managing YouTube player functionality
 * Provides comprehensive control over YouTube video playback, dimensions tracking,
 * and player state management with keyboard shortcuts and API integration.
 * 
 * @param videoId - Optional video ID to override the default or URL parameter
 * @returns Object containing player instance, state, dimensions, and control functions
 */
export const useYouTubePlayer = (videoId?: string) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number; top: number; left: number } | null>(null);

  /**
   * Retrieves the video ID from URL parameters, props, or default configuration
   * Priority: URL parameter > prop videoId > default config value
   * 
   * @returns The video ID to be used for the YouTube player
   */
  const getVideoId = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('videoId') || videoId || CONFIG.video.defaultVideoId;
  }, [videoId]);

  /**
   * Loads the YouTube IFrame API and initializes the player
   * If the API is already loaded, initializes the player immediately
   * Otherwise, dynamically loads the API script and sets up the callback
   */
  const loadYouTubeAPI = useCallback(() => {
    if (window.YT) {
      initializePlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = initializePlayer;
  }, []);

  /**
   * Initializes the YouTube player with specific configuration
   * Sets up player parameters for optimal HUD integration:
   * - Autoplay enabled
   * - Controls hidden for clean interface
   * - Keyboard controls disabled
   * - Fullscreen disabled
   * - Annotations hidden
   * - Related videos minimized
   * - Audio unmuted by default
   */
  const initializePlayer = useCallback(() => {
    try {
      // YouTube Player Parameters: 
      // https://developers.google.com/youtube/player_parameters
      const newPlayer: Player = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: getVideoId(),
        playerVars: {
          autoplay: 1,       // Controls whether the video starts playing automatically when the player loads
          controls: 0,       // Determines whether player controls (play/pause, volume, etc.) are displayed
          disablekb: 1,      // Disables keyboard controls for the player
          fs: 0,             // Prevents the fullscreen button from being displayed
          iv_load_policy: 3, // Controls whether video annotations are shown by default
          modestbranding: 1, // This parameter is deprecated and no longer has any effect
          playsinline: 1,    // Controls whether videos play inline or fullscreen on iOS devices
          rel: 0,            // Controls what related videos are shown when playback ends
          mute: 0            // Does not mute the video by default
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange
        }
      });

      // Store the player reference (this fixes the unused variable warning)
      setPlayer(newPlayer);
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
    }
  }, [getVideoId]);

  /**
   * Updates the video dimensions state based on the current iframe size
   * Calculates the actual video area within the iframe container,
   * accounting for letterboxing/pillarboxing based on aspect ratios
   */
  const updateVideoDimensions = useCallback(() => {
    if (!player || !isReady) return;

    try {
      // Get the YouTube iframe element
      const iframe = document.getElementById('youtube-player') as HTMLIFrameElement;
      if (!iframe) return;

      const { actualWidth, actualHeight, offsetTop, offsetLeft } = calculateDimensions(iframe);

      setVideoDimensions({
        width: actualWidth,
        height: actualHeight,
        top: offsetTop,
        left: offsetLeft
      });
    } catch (error) {
      console.error('Error updating video dimensions:', error);
    }
  }, [player, isReady]);

  /**
   * Calculates the actual video dimensions within the iframe container
   * Determines the video's display area by comparing container and video aspect ratios
   * Handles both letterboxing (black bars on sides) and pillarboxing (black bars on top/bottom)
   * 
   * @param iframe - The YouTube iframe element
   * @returns Object containing actual video dimensions and position offsets
   */
  const calculateDimensions = (iframe: HTMLIFrameElement) => {
    const containerRect = iframe.getBoundingClientRect();

    // ASSUMPTION: Most YouTube videos are 16:9 aspect ratio
    const videoAspectRatio = 16 / 9;

    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let actualWidth, actualHeight, offsetTop, offsetLeft;

    if (containerAspectRatio > videoAspectRatio) {
      // Container is wider than video - black bars on sides
      actualHeight = containerHeight;
      actualWidth = containerHeight * videoAspectRatio;
      offsetTop = containerRect.top;
      offsetLeft = containerRect.left + (containerWidth - actualWidth) / 2;
    } else {
      // Container is taller than video - black bars on top/bottom
      actualWidth = containerWidth;
      actualHeight = containerWidth / videoAspectRatio;
      offsetLeft = containerRect.left;
      offsetTop = containerRect.top + (containerHeight - actualHeight) / 2;
    }

    return { actualWidth, actualHeight, offsetTop, offsetLeft };
  };

  /**
   * Handles the YouTube player ready event
   * Automatically starts video playback and begins dimension tracking
   * 
   * @param event - YouTube player ready event object
   */
  const onPlayerReady = useCallback((event: PlayerEvent) => {
    try {
      event.target.playVideo();
      setIsReady(true);
      // Start tracking video dimensions after player is ready
      setTimeout(updateVideoDimensions, 100);
    } catch (error) {
      console.error('Error initializing player:', error);
    }
  }, [updateVideoDimensions]);

  /**
   * Handles YouTube player state change events
   * Updates the isPlaying state based on the current player state
   * 
   * @param event - YouTube player state change event object
   */
  const onPlayerStateChange = useCallback((event: PlayerEvent) => {
    setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
  }, []);

  useEffect(() => {
    loadYouTubeAPI();
  }, [loadYouTubeAPI]);

  // Track video dimensions on resize and player state changes
  useEffect(() => {
    if (!isReady) return;

    const handleResize = () => {
      updateVideoDimensions();
    };

    window.addEventListener('resize', handleResize);

    // Update dimensions periodically to handle dynamic changes
    const interval = setInterval(updateVideoDimensions, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [isReady, updateVideoDimensions]);

  /**
   * Toggles video playback between play and pause states
   * Checks current player state and switches to the opposite state
   */
  const togglePlayPause = useCallback(() => {
    if (!player) return;

    try {
      const state = player.getPlayerState();
      if (state === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [player]);

  /**
   * Seeks the video forward or backward by a specified number of seconds
   * Ensures the new position stays within the video's duration bounds
   * 
   * @param seconds - Number of seconds to seek (positive for forward, negative for backward)
   */
  const seekVideo = useCallback((seconds: number) => {
    if (!player) return;

    try {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      player.seekTo(newTime, true);
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  }, [player]);

  /**
   * Sets the video playback rate (speed)
   * Common rates: 0.25, 0.5, 1, 1.25, 1.5, 2
   * 
   * @param rate - Playback rate multiplier (1 = normal speed)
   */
  const setPlaybackRate = useCallback((rate: number) => {
    if (!player) return;

    try {
      player.setPlaybackRate(rate);
    } catch (error) {
      console.error('Error setting playback rate:', error);
    }
  }, [player]);

  return {
    player,
    isPlaying,
    isReady,
    videoDimensions,
    togglePlayPause,
    seekVideo,
    setPlaybackRate
  };
};

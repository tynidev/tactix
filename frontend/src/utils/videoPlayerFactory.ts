import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { extractYouTubeId } from './videoUtils';
import type { VideoPlayer } from '../types/videoPlayer';

interface Game
{
  id: string;
  video_id: string | null; // DEPRECATED: Use video_url instead
  video_url: string | null;
  // Add other relevant game properties as needed
}

/**
 * Factory function that creates the appropriate video player based on the game data
 * Currently supports YouTube, but designed to be extensible for other providers
 *
 * @param game - The game object containing video information
 * @returns VideoPlayer instance for the appropriate provider
 */
export function createVideoPlayer(game: Game): VideoPlayer
{
  // For now, we only support YouTube videos
  // In the future, this could detect different video providers:
  // - YouTube URLs (youtube.com/watch?v=...)
  // - Vimeo URLs (vimeo.com/...)
  // - Direct video files (.mp4, .webm, etc.)
  // - Other video platforms

  // Prefer video_url over video_id for backward compatibility
  const videoInput = game.video_url || game.video_id;

  if (!videoInput)
  {
    console.error('No video URL or ID provided for game:', game.id);
    // Return a null/empty player controller for games without video
    return createNullVideoPlayer();
  }

  const videoProvider = detectVideoProvider(videoInput);

  switch (videoProvider)
  {
    case 'youtube':
      // Extract YouTube ID from URL if needed
      const youtubeId = extractYouTubeId(videoInput);
      if (!youtubeId)
      {
        console.error('Failed to extract YouTube ID from:', videoInput);
        return createErrorVideoPlayer(`Invalid YouTube URL or ID: ${videoInput}`);
      }
      return useYouTubePlayer(youtubeId);
    case 'unknown':
      return createErrorVideoPlayer(`Unsupported video format: ${videoInput}. Please use a YouTube URL or video ID.`);
    default:
      console.error('Unsupported video provider:', videoProvider, 'for input:', videoInput);
      return createErrorVideoPlayer(`Video provider "${videoProvider}" is not yet supported. Please use a YouTube URL or video ID.`);
  }
}

/**
 * Creates a null video player controller for games without video
 * This prevents the component from crashing when no video is available
 */
function createNullVideoPlayer(): VideoPlayer
{
  return {
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
    videoDimensions: null,
    togglePlayPause: () =>
    {},
    seekVideo: () =>
    {},
    seekToTime: () =>
    {},
    setPlaybackRate: () =>
    {},
    updateVideoDimensions: () =>
    {},
    getCurrentTime: () => 0,
    getPlayerState: () => -1,
    getPlaybackRate: () => 1,
    pauseVideo: () =>
    {},
    playVideo: () =>
    {},
    seekTo: () =>
    {},
  };
}

/**
 * Creates an error video player controller for unsupported video formats
 * This allows the UI to display appropriate error messages
 */
function createErrorVideoPlayer(errorMessage: string): VideoPlayer & { error: string }
{
  return {
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
    videoDimensions: null,
    togglePlayPause: () => {},
    seekVideo: () => {},
    seekToTime: () => {},
    setPlaybackRate: () => {},
    updateVideoDimensions: () => {},
    getCurrentTime: () => 0,
    getPlayerState: () => -1,
    getPlaybackRate: () => 1,
    pauseVideo: () => {},
    playVideo: () => {},
    seekTo: () => {},
    error: errorMessage, // Add error property
  };
}

/**
 * Detects the video provider based on the video ID or URL
 * This function can be expanded to support multiple providers
 *
 * @param videoInput - The video ID or URL
 * @returns The detected provider type
 */
function detectVideoProvider(videoInput: string): 'youtube' | 'vimeo' | 'direct' | 'unknown'
{
  if (!videoInput) return 'unknown';

  // YouTube URL detection
  if (videoInput.includes('youtube.com') || videoInput.includes('youtu.be'))
  {
    return 'youtube';
  }

  // YouTube video ID detection (11 characters, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(videoInput))
  {
    return 'youtube';
  }

  // Vimeo URL detection
  // if (videoInput.includes('vimeo.com/')) {
  //   return 'vimeo';
  // }

  // Direct video file detection
  if (/\.(mp4|webm|ogg|avi|mov)$/i.test(videoInput))
  {
    return 'direct';
  }

  // Return unknown instead of defaulting to YouTube
  return 'unknown';
}

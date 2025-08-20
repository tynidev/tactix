import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import type { VideoPlayer } from '../types/videoPlayer';

interface Game
{
  id: string;
  video_id: string | null;
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
  // - YouTube video IDs (11 characters)
  // - Vimeo URLs (vimeo.com/...)
  // - Direct video files (.mp4, .webm, etc.)
  // - Other video platforms

  if (!game.video_id)
  {
    console.error('No video ID provided for game:', game.id);
    // Return a null/empty player controller for games without video
    return createNullVideoPlayer();
  }

  const videoProvider = detectVideoProvider(game.video_id);

  switch (videoProvider)
  {
    case 'youtube':
      return useYouTubePlayer(game.video_id);
      break;
    default:
      console.error('No Video Provider Found:', game.video_id);
      return createNullVideoPlayer();
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
 * Detects the video provider based on the video ID or URL
 * This function can be expanded to support multiple providers
 *
 * @param videoId - The video ID or URL
 * @returns The detected provider type
 */
function detectVideoProvider(videoId: string): 'youtube' | 'vimeo' | 'direct' | 'unknown'
{
  if (!videoId) return 'unknown';

  // YouTube video ID detection (11 characters, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(videoId))
  {
    return 'youtube';
  }

  // Vimeo URL detection
  // if (videoId.includes('vimeo.com/')) {
  //   return 'vimeo';
  // }

  // Direct video file detection
  if (/\.(mp4|webm|ogg|avi|mov)$/i.test(videoId))
  {
    return 'direct';
  }

  // Default to YouTube for backwards compatibility
  return 'youtube';
}

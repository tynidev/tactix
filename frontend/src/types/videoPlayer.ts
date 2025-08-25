/**
 * Abstract interface for video player controllers
 * This interface abstracts the YouTube Player functionality to enable
 * future support for multiple video providers while maintaining a consistent API.
 */
export interface VideoPlayer
{
  // State properties
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;

  // Dimension tracking for overlay positioning
  videoDimensions: {
    width: number;
    height: number;
    top: number;
    left: number;
  } | null;

  // High-level control methods
  togglePlayPause: () => void;
  seekVideo: (seconds: number) => void;
  seekToTime: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  updateVideoDimensions: () => void;

  // Low-level control methods (abstracts direct player API calls)
  getCurrentTime: () => number;
  getPlayerState: () => number;
  getPlaybackRate: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (time: number, allowSeekAhead?: boolean) => void;

  // Optional error property for error states
  error?: string;
}

/**
 * Union type for video player factory results
 * Allows for proper type checking of error states
 */
export type VideoPlayerResult = VideoPlayer | (VideoPlayer & { error: string });

/**
 * Player state constants for cross-platform compatibility
 * Based on YouTube Player API states but abstracted for future use
 */
export const VideoPlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type VideoPlayerStateType = typeof VideoPlayerState[keyof typeof VideoPlayerState];

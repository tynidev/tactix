// YouTube API types
export interface YT
{
  Player: new(elementId: string, config: PlayerConfig) => Player;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

export interface PlayerConfig
{
  height: string;
  width: string;
  videoId: string;
  playerVars: {
    autoplay: number;
    controls: number;
    disablekb: number;
    fs: number;
    iv_load_policy: number;
    modestbranding: number;
    playsinline: number;
    rel: number;
    mute: number;
  };
  events: {
    onReady: (event: PlayerEvent) => void;
    onStateChange: (event: PlayerEvent) => void;
  };
}

export interface Player
{
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  destroy(): void;
}

export interface PlayerEvent
{
  target: Player;
  data: number;
}

declare global
{
  interface Window
  {
    YT: YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

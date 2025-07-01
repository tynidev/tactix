import { useEffect, useState, useCallback } from 'react';
import type { Player, PlayerEvent } from '../types/youtube';
import { CONFIG } from '../types/config';

export const useYouTubePlayer = (videoId?: string) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number; top: number; left: number } | null>(null);

  const getVideoId = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('videoId') || videoId || CONFIG.video.defaultVideoId;
  }, [videoId]);

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

  const initializePlayer = useCallback(() => {
    try {
      const newPlayer: Player = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: getVideoId(),
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          mute: 1
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

  const updateVideoDimensions = useCallback(() => {
    if (!player || !isReady) return;

    try {
      // Get the YouTube iframe element
      const iframe = document.getElementById('youtube-player') as HTMLIFrameElement;
      if (!iframe) return;

      const containerRect = iframe.getBoundingClientRect();
      
      // Most YouTube videos are 16:9 aspect ratio
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

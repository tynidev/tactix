import { useCallback, useEffect } from 'react';
import { CONFIG, type DrawingMode } from '../types/config';
import { VideoPlayer } from '../types/videoPlayer';

interface UseKeyboardShortcutsProps
{
  videoPlayer: VideoPlayer;
  togglePlayPause: () => void; // Use wrapped function instead of videoPlayer.togglePlayPause
  seekVideo: (seconds: number) => void; // Use wrapped function instead of videoPlayer.seekVideo
  setPlaybackRate: (rate: number) => void;
  changeColor: (color: string) => void;
  changeMode: (mode: DrawingMode) => void;
  clearCanvas: () => void;
  undoLastDrawing: () => void;
  disabled?: boolean; // Disable shortcuts when modal is open
}

export const useKeyboardShortcuts = ({
  videoPlayer,
  togglePlayPause,
  seekVideo,
  setPlaybackRate,
  changeColor,
  changeMode,
  clearCanvas,
  undoLastDrawing,
  disabled = false,
}: UseKeyboardShortcutsProps) =>
{
  const handleKeyDown = useCallback((e: KeyboardEvent) =>
  {
    // Don't handle shortcuts if disabled (e.g., when modal is open)
    if (disabled) return;

    const key = e.key.toLowerCase();

    // Prevent default for specific keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
    {
      e.preventDefault();
    }

    switch (key)
    {
      case '1':
        changeColor(CONFIG.drawing.colors.color1);
        break;
      case '2':
        changeColor(CONFIG.drawing.colors.color2);
        break;
      case '3':
        changeColor(CONFIG.drawing.colors.color3);
        break;
      case '4':
        changeMode('arrow');
        break;
      case '5':
        changeMode('line');
        break;
      case '6':
        changeMode('rectangle');
        break;
      case '7':
        changeMode('ellipse');
        break;
      case 'e':
      case 'c':
        clearCanvas();
        break;
      case 'z':
        undoLastDrawing();
        break;
      case ' ':
        togglePlayPause();
        break;
      case 'a':
      case 'arrowleft':
        seekVideo(-CONFIG.video.seekAmount);
        break;
      case 'd':
      case 'arrowright':
        seekVideo(CONFIG.video.seekAmount);
        break;
      case 'w':
      case 'arrowup':
      {
        // Speed up: cycle through 0.25x -> 0.5x -> 1x -> 2x
        let rate = CONFIG.video.playbackRates.fast;
        try
        {
          if (typeof videoPlayer.getPlaybackRate === 'function')
          {
            const currentRate = videoPlayer.getPlaybackRate();
            if (currentRate === CONFIG.video.playbackRates.verySlow)
            {
              rate = CONFIG.video.playbackRates.slow;
            }
            else if (currentRate === CONFIG.video.playbackRates.slow)
            {
              rate = CONFIG.video.playbackRates.normal;
            }
            else if (currentRate === CONFIG.video.playbackRates.normal)
            {
              rate = CONFIG.video.playbackRates.fast;
            }
            else
            {
              rate = CONFIG.video.playbackRates.fast; // Already at max, stay there
            }
          }
        }
        catch (error)
        {
          console.warn('Failed to get playback rate for speed up, using fallback:', error);
        }
        setPlaybackRate(rate);
        break;
      }
      case 's':
      case 'arrowdown':
      {
        // Speed down: cycle through 2x -> 1x -> 0.5x -> 0.25x
        let rate = CONFIG.video.playbackRates.verySlow;
        try
        {
          if (typeof videoPlayer.getPlaybackRate === 'function')
          {
            const currentRate = videoPlayer.getPlaybackRate();
            if (currentRate === CONFIG.video.playbackRates.fast)
            {
              rate = CONFIG.video.playbackRates.normal;
            }
            else if (currentRate === CONFIG.video.playbackRates.normal)
            {
              rate = CONFIG.video.playbackRates.slow;
            }
            else if (currentRate === CONFIG.video.playbackRates.slow)
            {
              rate = CONFIG.video.playbackRates.verySlow;
            }
            else
            {
              rate = CONFIG.video.playbackRates.verySlow; // Already at min, stay there
            }
          }
        }
        catch (error)
        {
          console.warn('Failed to get playback rate for speed down, using fallback:', error);
        }
        setPlaybackRate(rate);
        break;
      }
    }
  }, [
    disabled,
    videoPlayer,
    togglePlayPause,
    seekVideo,
    setPlaybackRate,
    changeColor,
    changeMode,
    clearCanvas,
    undoLastDrawing,
  ]);

  useEffect(() =>
  {
    document.addEventListener('keydown', handleKeyDown);

    return () =>
    {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

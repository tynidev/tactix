import { useCallback, useEffect } from 'react';
import { CONFIG, type DrawingMode } from '../types/config';
import type { Player } from '../types/youtube';

interface UseKeyboardShortcutsProps
{
  player: Player | null;
  togglePlayPause: () => void;
  seekVideo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  changeColor: (color: string) => void;
  changeMode: (mode: DrawingMode) => void;
  clearCanvas: () => void;
  undoLastDrawing: () => void;
  disabled?: boolean; // Disable shortcuts when modal is open
}

export const useKeyboardShortcuts = ({
  player,
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
        // Speed up
        if (player)
        {
          let rate = CONFIG.video.playbackRates.fast;
          try
          {
            if (typeof player.getPlaybackRate === 'function' && player.getPlaybackRate() < 1)
            {
              rate = CONFIG.video.playbackRates.normal;
            }
          }
          catch (error)
          {
            console.warn('Failed to get playback rate for speed up, using fallback:', error);
          }
          setPlaybackRate(rate);
        }
        break;
      case 's':
      case 'arrowdown':
        // Speed down
        if (player)
        {
          let rate = CONFIG.video.playbackRates.slow;
          try
          {
            if (typeof player.getPlaybackRate === 'function' && player.getPlaybackRate() > 1)
            {
              rate = CONFIG.video.playbackRates.normal;
            }
          }
          catch (error)
          {
            console.warn('Failed to get playback rate for speed down, using fallback:', error);
          }
          setPlaybackRate(rate);
        }
        break;
    }
  }, [
    disabled,
    player,
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

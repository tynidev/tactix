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
    console.log('Key pressed:', key);

    // Prevent default for specific keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
    {
      e.preventDefault();
    }

    switch (key)
    {
      case '1':
        console.log('Changing to color1');
        changeColor(CONFIG.drawing.colors.color1);
        break;
      case '2':
        console.log('Changing to color2');
        changeColor(CONFIG.drawing.colors.color2);
        break;
      case '3':
        console.log('Changing to color3');
        changeColor(CONFIG.drawing.colors.color3);
        break;
      case '4':
        console.log('Changing to arrow mode');
        changeMode('arrow');
        break;
      case '5':
        console.log('Changing to line mode');
        changeMode('line');
        break;
      case '6':
        console.log('Changing to rectangle mode');
        changeMode('rectangle');
        break;
      case '7':
        console.log('Changing to ellipse mode');
        changeMode('ellipse');
        break;
      case 'e':
      case 'c':
        console.log('Clearing canvas via keyboard');
        clearCanvas();
        break;
      case 'z':
        console.log('Undoing last drawing via keyboard');
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
          const currentRate = player.getPlaybackRate();
          if (currentRate < 2)
          {
            if (currentRate < 1)
            {
              setPlaybackRate(CONFIG.video.playbackRates.normal);
            }
            else
            {
              setPlaybackRate(CONFIG.video.playbackRates.fast);
            }
          }
        }
        break;
      case 's':
      case 'arrowdown':
        // Speed down
        if (player)
        {
          const currentRate = player.getPlaybackRate();
          if (currentRate > 0.5)
          {
            if (currentRate > 1)
            {
              setPlaybackRate(CONFIG.video.playbackRates.normal);
            }
            else
            {
              setPlaybackRate(CONFIG.video.playbackRates.slow);
            }
          }
        }
        break;
    }
  }, [disabled, player, togglePlayPause, seekVideo, setPlaybackRate, changeColor, changeMode, clearCanvas, undoLastDrawing]);

  useEffect(() =>
  {
    document.addEventListener('keydown', handleKeyDown);

    return () =>
    {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

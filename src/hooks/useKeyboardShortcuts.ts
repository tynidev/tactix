import { useCallback, useEffect } from 'react';
import { CONFIG, type DrawingColor, type DrawingMode } from '../types/config';
import type { Player } from '../types/youtube';

interface UseKeyboardShortcutsProps
{
  player: Player | null;
  togglePlayPause: () => void;
  seekVideo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  changeColor: (color: DrawingColor) => void;
  changeMode: (mode: DrawingMode) => void;
  clearCanvas: () => void;
  undoLastDrawing: () => void;
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
}: UseKeyboardShortcutsProps) =>
{
  const handleKeyDown = useCallback((e: KeyboardEvent) =>
  {
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
        changeColor('color1');
        break;
      case '2':
        console.log('Changing to color2');
        changeColor('color2');
        break;
      case '3':
        console.log('Changing to color3');
        changeColor('color3');
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
  }, [player, togglePlayPause, seekVideo, setPlaybackRate, changeColor, changeMode, clearCanvas, undoLastDrawing]);

  useEffect(() =>
  {
    document.addEventListener('keydown', handleKeyDown);

    return () =>
    {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

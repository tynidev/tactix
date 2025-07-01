import { useCallback, useEffect } from 'react';
import { CONFIG, type DrawingColor, type DrawingMode } from '../types/config';

interface UseKeyboardShortcutsProps
{
  togglePlayPause: () => void;
  seekVideo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  changeColor: (color: DrawingColor) => void;
  changeMode: (mode: DrawingMode) => void;
  clearCanvas: () => void;
  undoLastDrawing: () => void;
  currentPlaybackRate?: number;
}

export const useKeyboardShortcuts = ({
  togglePlayPause,
  seekVideo,
  setPlaybackRate,
  changeColor,
  changeMode,
  clearCanvas,
  undoLastDrawing,
  currentPlaybackRate = 1,
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
        if (currentPlaybackRate < 2)
        {
          if (currentPlaybackRate < 1)
          {
            setPlaybackRate(CONFIG.video.playbackRates.normal);
          }
          else
          {
            setPlaybackRate(CONFIG.video.playbackRates.fast);
          }
        }
        break;
      case 's':
      case 'arrowdown':
        // Speed down
        if (currentPlaybackRate > 0.5)
        {
          if (currentPlaybackRate > 1)
          {
            setPlaybackRate(CONFIG.video.playbackRates.normal);
          }
          else
          {
            setPlaybackRate(CONFIG.video.playbackRates.slow);
          }
        }
        break;
    }
  }, [togglePlayPause, seekVideo, setPlaybackRate, changeColor, changeMode, clearCanvas, undoLastDrawing, currentPlaybackRate]);

  useEffect(() =>
  {
    document.addEventListener('keydown', handleKeyDown);

    return () =>
    {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

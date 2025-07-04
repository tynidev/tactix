import React, { useCallback } from 'react';
import { useDrawingCanvas } from '../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import DrawingCanvas from './DrawingCanvas/DrawingCanvas';
import Toolbar from './Toolbar/Toolbar';
import YouTubePlayer from './YouTubePlayer/YouTubePlayer';
import './TactixHUD.css';

const TactixHUD: React.FC = () =>
{
  // YouTube player functionality
  const {
    player,
    isPlaying,
    isReady,
    videoDimensions,
    togglePlayPause,
    seekVideo,
    setPlaybackRate,
  } = useYouTubePlayer();

  // Drawing canvas functionality
  const {
    canvasRef,
    currentColor,
    currentMode,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    changeColor,
    changeMode,
    undoLastDrawing,
  } = useDrawingCanvas();

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) =>
  {
    setPlaybackRate(rate);
  }, [setPlaybackRate]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    player,
    togglePlayPause,
    seekVideo,
    setPlaybackRate: handlePlaybackRateChange,
    changeColor,
    changeMode,
    clearCanvas,
    undoLastDrawing,
  });

  return (
    <div className='tactix-hud'>
      <YouTubePlayer className={isReady ? '' : 'loading'} />
      <DrawingCanvas
        canvasRef={canvasRef}
        startDrawing={startDrawing}
        draw={draw}
        stopDrawing={stopDrawing}
        videoDimensions={videoDimensions}
      />
      <Toolbar
        currentColor={currentColor}
        currentMode={currentMode}
        isPlaying={isPlaying}
        currentPlaybackRate={player?.getPlaybackRate() ?? 1}
        onColorChange={changeColor}
        onModeChange={changeMode}
        onClearCanvas={clearCanvas}
        onTogglePlayPause={togglePlayPause}
        onSeek={seekVideo}
        onPlaybackRateChange={handlePlaybackRateChange}
      />
    </div>
  );
};

export default TactixHUD;

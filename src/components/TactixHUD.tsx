import React, { useCallback, useState } from 'react';
import { useDrawingCanvas } from '../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { CONFIG } from '../types/config';
import DrawingCanvas from './DrawingCanvas/DrawingCanvas';
import Toolbar from './Toolbar/Toolbar';
import YouTubePlayer from './YouTubePlayer/YouTubePlayer';
import './TactixHUD.css';

const TactixHUD: React.FC = () =>
{
  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(CONFIG.video.playbackRates.normal);

  // YouTube player functionality
  const {
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
  } = useDrawingCanvas();

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) =>
  {
    setCurrentPlaybackRate(rate);
    setPlaybackRate(rate);
  }, [setPlaybackRate]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    togglePlayPause,
    seekVideo,
    setPlaybackRate: handlePlaybackRateChange,
    changeColor,
    changeMode,
    clearCanvas,
    currentPlaybackRate,
  });

  return (
    <div className='tactix-hud'>
      <YouTubePlayer className={isReady ? '' : 'loading'} />
      <DrawingCanvas
        canvasRef={canvasRef}
        currentColor={currentColor}
        startDrawing={startDrawing}
        draw={draw}
        stopDrawing={stopDrawing}
        videoDimensions={videoDimensions}
      />
      <Toolbar
        currentColor={currentColor}
        currentMode={currentMode}
        isPlaying={isPlaying}
        currentPlaybackRate={currentPlaybackRate}
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

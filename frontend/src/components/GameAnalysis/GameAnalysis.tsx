import React, { useCallback, useEffect, useState } from 'react';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import Toolbar from '../Toolbar/Toolbar';
import YouTubePlayer from '../YouTubePlayer/YouTubePlayer';
import type { Drawing } from '../../types/drawing';
import './GameAnalysis.css';

interface Game {
  id: string;
  opponent: string;
  date: string;
  location: string | null;
  video_id: string | null;
  team_score: number | null;
  opp_score: number | null;
  game_type: 'regular' | 'tournament' | 'scrimmage';
  home_away: 'home' | 'away' | 'neutral';
  notes: string | null;
  created_at: string;
  teams?: {
    id: string;
    name: string;
  };
}

interface GameAnalysisProps {
  game: Game;
  onBack: () => void;
}

export const GameAnalysis: React.FC<GameAnalysisProps> = ({ game, onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showCoachingPointModal, setShowCoachingPointModal] = useState(false);

  // YouTube player functionality - initialize with the game's video ID
  const {
    player,
    isPlaying,
    isReady,
    videoDimensions,
    togglePlayPause,
    seekVideo,
    setPlaybackRate,
  } = useYouTubePlayer(game.video_id || undefined);

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
    getDrawingData,
    setDrawingData,
  } = useDrawingCanvas();

  // Load the game video when component mounts or video_id changes
  useEffect(() => {
    if (game.video_id) {
      // The video ID is passed to the hook, so the player will load it automatically
      // We can also update the URL parameter to reflect the current video
      const url = new URL(window.location.href);
      url.searchParams.set('videoId', game.video_id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [game.video_id]);

  // Track current video time
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player.getCurrentTime) {
        setCurrentTime(player.getCurrentTime());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player]);

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, [setPlaybackRate]);

  // Handle creating a coaching point
  const handleCreateCoachingPoint = useCallback(() => {
    if (!player) return;

    // Only allow creating coaching points when video is paused
    if (isPlaying) {
      alert('Please pause the video to add a coaching point.');
      return;
    }

    const timestamp = player.getCurrentTime();
    console.log('Creating coaching point at:', timestamp);
    setShowCoachingPointModal(true);
  }, [player, isPlaying]);

  // Handle starting/stopping recording
  const handleToggleRecording = useCallback(() => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      console.log('Started recording session');
      // TODO: Implement recording session start
    } else {
      console.log('Stopped recording session');
      // TODO: Implement recording session save
    }
  }, [isRecording]);

  // Handle seeking to a coaching point timestamp
  const handleSeekToPoint = useCallback((timestampMs: string) => {
    if (!player) return;

    const timestamp = parseInt(timestampMs, 10) / 1000;
    console.log('Seeking to timestamp:', timestamp);
    // Use seekTo with allowSeekAhead set to true
    player.seekTo(timestamp, true);
  }, [player]);

  // Handle showing drawings from a coaching point
  const handleShowDrawings = useCallback((drawings: Drawing[]) => {
    setDrawingData(drawings);
  }, [setDrawingData]);

  // Handle pausing the video
  const handlePauseVideo = useCallback(() => {
    if (!player || !isPlaying) return;

    console.log('Pausing video');
    player.pauseVideo();
  }, [player, isPlaying]);

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
    disabled: showCoachingPointModal, // Disable shortcuts when modal is open
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatGameResult = (teamScore: number | null, oppScore: number | null) => {
    if (teamScore === null || oppScore === null) {
      return 'No score recorded';
    }
    return `${teamScore} - ${oppScore}`;
  };

  if (!game.video_id) {
    return (
      <div className="game-analysis">
        <div className="analysis-header">
          <button onClick={onBack} className="btn btn-secondary">
            ← Back to Games
          </button>
          <h1>Game Analysis</h1>
        </div>
        <div className="error-state">
          <h2>No Video Available</h2>
          <p>This game doesn't have a video URL. Please add a YouTube video URL to begin analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-analysis">
      <div className="analysis-header">
        <button onClick={onBack} className="btn btn-secondary">
          ← Back to Games
        </button>
        
        <div className="game-info">
          <h1>vs {game.opponent}</h1>
          <div className="game-meta">
            <span>{new Date(game.date).toLocaleDateString()}</span>
            <span>{formatGameResult(game.team_score, game.opp_score)}</span>
            <span className="current-time">{formatTime(currentTime)}</span>
          </div>
        </div>

        <div className="analysis-controls">
          <button
            onClick={handleCreateCoachingPoint}
            className="btn btn-primary"
            disabled={!isReady || isPlaying}
            title={isPlaying ? 'Pause video to add coaching point' : 'Add coaching point'}
          >
            Add Coaching Point
          </button>
          
          <button
            onClick={handleToggleRecording}
            className={`btn ${isRecording ? 'btn-error' : 'btn-success'}`}
            disabled={!isReady}
          >
            {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
          </button>
        </div>
      </div>

      <div className="analysis-workspace">
        <div className="video-container">
          <YouTubePlayer className={isReady ? '' : 'loading'} />
          <DrawingCanvas
            canvasRef={canvasRef}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            videoDimensions={videoDimensions}
          />
        </div>

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

      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          Recording Session
        </div>
      )}

      {/* Coaching Point Modal */}
      <CoachingPointModal
        isOpen={showCoachingPointModal}
        onClose={() => setShowCoachingPointModal(false)}
        gameId={game.id}
        timestamp={currentTime}
        drawingData={getDrawingData()}
      />

      {/* Coaching Points Flyout */}
      <CoachingPointsFlyout
        gameId={game.id}
        onSeekToPoint={handleSeekToPoint}
        onShowDrawings={handleShowDrawings}
        onPauseVideo={handlePauseVideo}
      />
    </div>
  );
};

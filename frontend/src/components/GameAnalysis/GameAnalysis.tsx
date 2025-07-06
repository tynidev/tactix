import React, { useCallback, useEffect, useState } from 'react';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import DrawingToolbar from '../DrawingToolbar/DrawingToolbar';
import TransportControl from '../TransportControl/TransportControl';
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

interface CoachingPoint {
  id: string;
  game_id: string;
  author_id: string;
  title: string;
  feedback: string;
  timestamp: string;
  audio_url: string;
  duration: number;
  created_at: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
  coaching_point_tagged_players?: {
    id: string;
    player_profiles: {
      id: string;
      name: string;
      jersey_number: string;
    };
  }[];
  coaching_point_labels?: {
    id: string;
    labels: {
      id: string;
      name: string;
    };
  }[];
}

interface GameAnalysisProps {
  game: Game;
  onBack: () => void;
}

export const GameAnalysis: React.FC<GameAnalysisProps> = ({ game, onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showCoachingPointModal, setShowCoachingPointModal] = useState(false);
  const [coachingPointsRefresh, setCoachingPointsRefresh] = useState(0);
  const [selectedCoachingPoint, setSelectedCoachingPoint] = useState<CoachingPoint | null>(null);

  // Set body class for fullscreen and force dark theme
  useEffect(() => {
    document.body.className = 'hud-mode';
    
    // Store the current theme and force dark mode
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', 'dark');
    
    return () => {
      document.body.className = '';
      // Restore the original theme
      document.documentElement.setAttribute('data-theme', currentTheme);
    };
  }, []);

  // YouTube player functionality - initialize with the game's video ID
  const {
    player,
    isPlaying,
    isReady,
    currentTime: playerCurrentTime,
    duration,
    videoDimensions,
    togglePlayPause,
    seekVideo,
    seekToTime,
    setPlaybackRate,
    updateVideoDimensions,
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
  // Note: currentTime is now provided by the useYouTubePlayer hook as playerCurrentTime

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

  // Handle when a coaching point is created successfully
  const handleCoachingPointCreated = useCallback(() => {
    // Trigger a refresh of the coaching points flyout
    setCoachingPointsRefresh(prev => prev + 1);
  }, []);

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

  // Handle selecting a coaching point
  const handleSelectCoachingPoint = useCallback((point: CoachingPoint | null) => {
    setSelectedCoachingPoint(point);
  }, []);

  // Update video dimensions when sidebar state changes
  useEffect(() => {
    if (isReady && updateVideoDimensions) {
      // Use a small delay to ensure CSS layout changes have been applied
      const timer = setTimeout(() => {
        updateVideoDimensions();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [selectedCoachingPoint, isReady, updateVideoDimensions]);

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
        
        <div className="game-meta">
          <span>{new Date(game.date).toLocaleDateString()}</span>
          <span>{formatGameResult(game.team_score, game.opp_score)}</span>
          <span className="current-time">{formatTime(playerCurrentTime)}</span>
        </div>

        <div className="game-info">
          <h1>vs {game.opponent}</h1>
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

      <div className={`analysis-workspace ${selectedCoachingPoint ? 'with-sidebar' : ''}`}>
        <div className={`video-container ${selectedCoachingPoint ? 'with-sidebar' : ''}`}>
          <YouTubePlayer className={isReady ? '' : 'loading'}>
            <TransportControl
              isPlaying={isPlaying}
              currentTime={playerCurrentTime}
              duration={duration}
              currentPlaybackRate={player?.getPlaybackRate() ?? 1}
              onTogglePlayPause={togglePlayPause}
              onSeek={seekVideo}
              onSeekTo={seekToTime}
              onPlaybackRateChange={handlePlaybackRateChange}
            />
          </YouTubePlayer>
          <DrawingCanvas
            canvasRef={canvasRef}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            videoDimensions={videoDimensions}
          />
          
          <DrawingToolbar
            currentColor={currentColor}
            currentMode={currentMode}
            onColorChange={changeColor}
            onModeChange={changeMode}
            onClearCanvas={clearCanvas}
          />
        </div>

        {selectedCoachingPoint && (
          <div className="coaching-point-sidebar">
            <div className="sidebar-header">
              <h3>Coaching Point Details</h3>
              <button 
                onClick={() => handleSelectCoachingPoint(null)}
                className="btn btn-secondary btn-sm"
                title="Close details"
              >
                ✕
              </button>
            </div>
            <div className="sidebar-content">
              <div className="coaching-point-details">
                <h4 className="point-title">{selectedCoachingPoint.title}</h4>
                <div className="point-meta">
                  <span className="point-timestamp">
                    {formatTime(parseInt(selectedCoachingPoint.timestamp) / 1000)}
                  </span>
                  <span className="point-author">
                    by {selectedCoachingPoint.author?.name || 'Unknown'}
                  </span>
                </div>
                <div className="point-feedback">
                  <h5>Feedback:</h5>
                  <p>{selectedCoachingPoint.feedback}</p>
                </div>
                {selectedCoachingPoint.coaching_point_tagged_players && selectedCoachingPoint.coaching_point_tagged_players.length > 0 && (
                  <div className="point-players">
                    <h5>Tagged Players:</h5>
                    <div className="player-tags">
                      {selectedCoachingPoint.coaching_point_tagged_players.map((taggedPlayer) => (
                        <span key={taggedPlayer.id} className="player-tag">
                          {taggedPlayer.player_profiles.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedCoachingPoint.coaching_point_labels && selectedCoachingPoint.coaching_point_labels.length > 0 && (
                  <div className="point-labels">
                    <h5>Labels:</h5>
                    <div className="label-tags">
                      {selectedCoachingPoint.coaching_point_labels.map((labelAssignment) => (
                        <span key={labelAssignment.id} className="label-tag">
                          {labelAssignment.labels.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
        timestamp={playerCurrentTime}
        drawingData={getDrawingData()}
        onCoachingPointCreated={handleCoachingPointCreated}
      />

      {/* Coaching Points Flyout */}
      <CoachingPointsFlyout
        gameId={game.id}
        onSeekToPoint={handleSeekToPoint}
        onShowDrawings={handleShowDrawings}
        onPauseVideo={handlePauseVideo}
        onSelectCoachingPoint={handleSelectCoachingPoint}
        refreshTrigger={coachingPointsRefresh}
      />
    </div>
  );
};

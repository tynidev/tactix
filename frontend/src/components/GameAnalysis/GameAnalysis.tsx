import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { useRecordingSession } from '../../hooks/useRecordingSession';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import DrawingToolbar from '../DrawingToolbar/DrawingToolbar';
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
  const [isFlyoutExpanded, setIsFlyoutExpanded] = useState(false);
  const [recordingData, setRecordingData] = useState<{
    audioBlob: Blob | null;
    recordingEvents: any[];
    recordingDuration: number;
  } | null>(null);
  const [recordingStartTimestamp, setRecordingStartTimestamp] = useState<number | null>(null);

  // Add this ref to track previous drawings
  const lastDrawingsRef = useRef<Drawing[]>([]);

  // Audio recording functionality
  const audioRecording = useAudioRecording();

  // Recording session functionality  
  const recordingSession = useRecordingSession();

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
    togglePlayPause: originalTogglePlayPause,
    seekVideo: originalSeekVideo,
    seekToTime: originalSeekToTime,
    setPlaybackRate,
    updateVideoDimensions,
  } = useYouTubePlayer(game.video_id || undefined);

  // Wrapped YouTube player controls to capture events during recording
  const togglePlayPause = useCallback(() => {
    if (isRecording && player) {
      const currentVideoTime = player.getCurrentTime();
      const action = isPlaying ? 'pause' : 'play';
      recordingSession.recordPlayPauseEvent(action, currentVideoTime);
    }
    originalTogglePlayPause();
  }, [isRecording, player, isPlaying, recordingSession, originalTogglePlayPause]);

  const seekVideo = useCallback((seconds: number) => {
    if (isRecording && player) {
      const fromTime = player.getCurrentTime();
      const toTime = fromTime + seconds;
      recordingSession.recordSeekEvent(fromTime, toTime);
    }
    originalSeekVideo(seconds);
  }, [isRecording, player, recordingSession, originalSeekVideo]);

  const seekToTime = useCallback((time: number) => {
    if (isRecording && player) {
      const fromTime = player.getCurrentTime();
      recordingSession.recordSeekEvent(fromTime, time);
    }
    originalSeekToTime(time);
  }, [isRecording, player, recordingSession, originalSeekToTime]);

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
    
    // Record speed change event if recording
    if (isRecording) {
      recordingSession.recordChangeSpeedEvent(rate);
    }
  }, [setPlaybackRate, isRecording, recordingSession]);

  // Handle creating a coaching point
  const handleCreateCoachingPoint = useCallback(() => {
    if (!player) return;

    // Only allow creating coaching points when video is paused
    if (isPlaying) {
      alert('Please pause the video to add a coaching point.');
      return;
    }

    // Don't pass recording data for manual coaching points
    setRecordingData(null);
    setRecordingStartTimestamp(null); // Reset recording start timestamp for manual points
    setShowCoachingPointModal(true);
  }, [player, isPlaying]);

  // Handle when a coaching point is created successfully
  const handleCoachingPointCreated = useCallback(() => {
    // Trigger a refresh of the coaching points flyout
    setCoachingPointsRefresh(prev => prev + 1);
  }, []);

  // Handle starting/stopping recording
  const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      // Start recording
      
      // Capture the current video timestamp before pausing
      const recordingStartTime = player ? player.getCurrentTime() : playerCurrentTime;
      
      // Pause video if playing
      if (isPlaying && player) {
        player.pauseVideo();
      }
      
      // Store the recording start timestamp
      setRecordingStartTimestamp(recordingStartTime);
      
      // Start audio recording
      const audioStarted = await audioRecording.startRecording();
      if (!audioStarted) {
        console.error('❌ Failed to start audio recording');
        setRecordingStartTimestamp(null); // Reset on failure
        return;
      }
      
      // Start recording session
      recordingSession.startRecordingSession();
      setIsRecording(true);
    } else {
      // Stop recording
      
      // Stop audio recording and get the blob
      const audioBlob = await audioRecording.stopRecording();
      
      // Stop recording session and get events
      const capturedEvents = recordingSession.stopRecordingSession();
      
      setIsRecording(false);
      
      // Prepare recording data
      const recordingData = {
        audioBlob: audioBlob,
        recordingEvents: capturedEvents,
        recordingDuration: audioRecording.recordingTime,
      };
      
      setRecordingData(recordingData);
      setShowCoachingPointModal(true);
    }
  }, [isRecording, isPlaying, player, playerCurrentTime, audioRecording, recordingSession]);

  // Handle seeking to a coaching point timestamp
  const handleSeekToPoint = useCallback((timestampMs: string) => {
    if (!player) return;

    const timestamp = parseInt(timestampMs, 10) / 1000;

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

  // Capture drawing changes during recording
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      const currentDrawings = getDrawingData();
      if (currentDrawings.length > 0 && videoDimensions) {
        // Only record if drawings have changed
        const drawingsChanged = JSON.stringify(currentDrawings) !== JSON.stringify(lastDrawingsRef.current);
        if (drawingsChanged) {
          recordingSession.recordDrawEvent(currentDrawings, {
            width: videoDimensions.width,
            height: videoDimensions.height,
          });
          lastDrawingsRef.current = [...currentDrawings];
        }
      }
    }, 50); // Capture every 50ms

    return () => clearInterval(interval);
  }, [isRecording, getDrawingData, videoDimensions, recordingSession]);

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
    disabled: showCoachingPointModal || isFlyoutExpanded, // Disable shortcuts when modal is open or flyout is expanded
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
        </div>
        
        <div className="game-meta">
          <span>Game Date: {new Date(game.date).toLocaleDateString()}</span>
          <span>Score: {formatGameResult(game.team_score, game.opp_score)}</span>
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
          <YouTubePlayer className={isReady ? '' : 'loading'} />
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

      {(isRecording || audioRecording.isRecording) && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording Session</span>
          {audioRecording.recordingTime > 0 && (
            <span className="recording-time">
              {Math.floor(audioRecording.recordingTime / 1000 / 60)}:
              {Math.floor((audioRecording.recordingTime / 1000) % 60).toString().padStart(2, '0')}
            </span>
          )}
          {audioRecording.error && (
            <span className="recording-error">{audioRecording.error}</span>
          )}
        </div>
      )}

      {/* Coaching Point Modal */}
      <CoachingPointModal
        isOpen={showCoachingPointModal}
        onClose={() => {
          setShowCoachingPointModal(false);
          setRecordingData(null);
          setRecordingStartTimestamp(null); // Reset recording start timestamp
        }}
        gameId={game.id}
        timestamp={recordingStartTimestamp !== null ? recordingStartTimestamp : playerCurrentTime}
        drawingData={getDrawingData()}
        onCoachingPointCreated={handleCoachingPointCreated}
        recordingData={recordingData}
      />

      {/* Coaching Points Flyout */}
      <CoachingPointsFlyout
        gameId={game.id}
        onSeekToPoint={handleSeekToPoint}
        onShowDrawings={handleShowDrawings}
        onPauseVideo={handlePauseVideo}
        onSelectCoachingPoint={handleSelectCoachingPoint}
        refreshTrigger={coachingPointsRefresh}
        onExpandedChange={setIsFlyoutExpanded}
        isPlaying={isPlaying}
        currentTime={playerCurrentTime}
        duration={duration}
        currentPlaybackRate={player?.getPlaybackRate() ?? 1}
        onTogglePlayPause={togglePlayPause}
        onSeek={seekVideo}
        onSeekTo={seekToTime}
        onPlaybackRateChange={handlePlaybackRateChange}
      />
    </div>
  );
};

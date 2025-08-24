// =============================
// Imports
// =============================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { useCoachingPointPlayback } from '../../hooks/useCoachingPointPlayback';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useRecordingSession } from '../../hooks/useRecordingSession';
import type { Drawing } from '../../types/drawing';
import { updateViewCompletion } from '../../utils/api';
import { createVideoPlayer } from '../../utils/videoPlayerFactory';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import DrawingToolbar from '../DrawingToolbar/DrawingToolbar';
import YouTubePlayer from '../YouTubePlayer/YouTubePlayer';
import { useAcknowledgment } from './hooks/useAcknowledgment';
import { useAutoHideUI } from './hooks/useAutoHideUI';
import { useGuardianPlayers } from './hooks/useGuardianPlayers';
import { useRecordingControls } from './hooks/useRecordingControls';
import { useVideoControls } from './hooks/useVideoControls';
import type { CoachingPoint, Game } from './types/gameAnalysisTypes';
import './GameAnalysis.css';
import CoachingPointSidebar from './components/CoachingPointSidebar';
import GameHeader from './components/GameHeader';
import { useCoachingPointSelection } from './hooks/useCoachingPointSelection';
import { useFullscreen } from './hooks/useFullscreen';
import { useGameAnalysisShortcuts } from './hooks/useGameAnalysisShortcuts';
import { usePlaybackEventHandlers } from './hooks/usePlaybackEventHandlers.ts';

// =============================
// Props
// =============================
interface GameAnalysisProps
{
  game: Game;
}

// =============================
// Component
// =============================
export const GameAnalysis: React.FC<GameAnalysisProps> = ({ game }) =>
{
  // -----------------------------
  // Local UI State
  // -----------------------------
  const [showCoachingPointModal, setShowCoachingPointModal] = useState(false);
  const [coachingPointsRefresh, setCoachingPointsRefresh] = useState(0);
  const [selectedCoachingPoint, setSelectedCoachingPoint] = useState<CoachingPoint | null>(null);
  const [isFlyoutExpanded, setIsFlyoutExpanded] = useState(false);
  // Fullscreen via hook
  const { isFullscreen, toggleFullscreen: handleToggleFullscreen } = useFullscreen();
  const [recordingData, setRecordingData] = useState<
    {
      audioBlob: Blob | null;
      recordingEvents: any[];
      recordingDuration: number;
    } | null
  >(null);
  const [recordingStartTimestamp, setRecordingStartTimestamp] = useState<number | null>(null);
  // -----------------------------
  // Data: Guardian Players
  // -----------------------------
  const {
    guardianPlayers,
    selectedPlayerId,
    setSelectedPlayerId,
    isLoadingGuardianPlayers,
    guardianPlayersError,
  } = useGuardianPlayers(game.teams?.id, game.user_role);

  // -----------------------------
  // Data: Acknowledgment
  // -----------------------------
  const {
    acknowledgment,
    notesValue,
    acknowledgedValue, // Corrected prop name
    isSavingAcknowledgment,
    acknowledgmentError,
    hasUnsavedChanges,
    saveSuccess,
    handleAcknowledgmentChange,
    handleNotesChange,
    handleSaveAcknowledgment,
  } = useAcknowledgment({
    selectedCoachingPointId: selectedCoachingPoint ? selectedCoachingPoint.id : null,
    userRole: game.user_role,
    selectedPlayerId,
  });

  // -----------------------------
  // UI: Auto-hide system
  // -----------------------------
  const {
    areBothUIElementsVisible,
    isCursorVisible,
    startInactivityTimer,
    applyImmediateHideWithGrace,
  } = useAutoHideUI();
  const [playbackStartedFromFlyout, setPlaybackStartedFromFlyout] = useState(false);

  // -----------------------------
  // Refs
  // -----------------------------
  // Track previous drawings
  const lastDrawingsRef = useRef<Drawing[]>([]);

  // Track if video was playing when we paused coaching point playback
  const wasVideoPlayingBeforePauseRef = useRef<boolean>(false);

  // -----------------------------
  // Hooks: Recording / Playback / Canvas
  // -----------------------------
  // Audio recording functionality
  const audioRecording = useAudioRecording();

  // Recording session functionality
  const recordingSession = useRecordingSession();

  // Coaching point playback functionality
  const playback = useCoachingPointPlayback();

  // startInactivityTimer provided by useAutoHideUI

  // -----------------------------
  // Effects: Global theme and video init
  // -----------------------------
  // Set body class for fullscreen and force dark theme
  useEffect(() =>
  {
    document.body.className = 'hud-mode';

    // Store the current theme and force dark mode
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', 'dark');

    return () =>
    {
      document.body.className = '';
      // Restore the original theme
      document.documentElement.setAttribute('data-theme', currentTheme);
    };
  }, []);

  // Video player functionality - initialize with the game's video ID using factory
  const videoPlayer = createVideoPlayer(game);

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

  // -----------------------------
  // Handlers: Coaching point lifecycle
  // -----------------------------
  // Dismiss coaching point and return to normal video mode
  const dismissCoachingPoint = useCallback(() =>
  {
    if (!selectedCoachingPoint) return;

    // Stop any coaching point playback
    if (playback.isPlaying)
    {
      playback.stopPlayback();
    }

    // Clear canvas
    clearCanvas();

    // Hide coaching point sidebar
    setSelectedCoachingPoint(null);
  }, [selectedCoachingPoint, playback, clearCanvas]);

  // Video controls will be initialized after recording controls (needs isRecording)

  // -----------------------------
  // Effects: Video URL sync
  // -----------------------------
  // Load the game video when component mounts or video_id changes
  useEffect(() =>
  {
    if (game.video_id)
    {
      // The video ID is passed to the hook, so the player will load it automatically
      // We can also update the URL parameter to reflect the current video
      const url = new URL(window.location.href);
      url.searchParams.set('videoId', game.video_id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [game.video_id]);

  // Track current video time
  // Note: currentTime is now provided by the useYouTubePlayer hook as playerCurrentTime

  // handlePlaybackRateChange provided by useVideoControls

  // -----------------------------
  // Handlers: Create & edit coaching points
  // -----------------------------
  // Handle creating a coaching point
  const handleCreateCoachingPoint = useCallback(() =>
  {
    if (!videoPlayer) return;

    // Only allow creating coaching points when video is paused
    if (videoPlayer.isPlaying)
    {
      alert('Please pause the video to add a coaching point.');
      return;
    }

    // Don't pass recording data for manual coaching points
    setRecordingData(null);
    setRecordingStartTimestamp(null); // Reset recording start timestamp for manual points
    setShowCoachingPointModal(true);
  }, [videoPlayer, videoPlayer.isPlaying]);

  // Handle when a coaching point is created successfully
  const handleCoachingPointCreated = useCallback(() =>
  {
    // Trigger a refresh of the coaching points flyout
    setCoachingPointsRefresh(prev => prev + 1);
  }, []);

  // Handle when a coaching point is updated successfully
  const handleCoachingPointUpdated = useCallback((updatedCoachingPoint: CoachingPoint) =>
  {
    // Update the selected coaching point with the new data
    setSelectedCoachingPoint(updatedCoachingPoint);
    // Trigger a refresh of the coaching points flyout
    setCoachingPointsRefresh(prev => prev + 1);
  }, []);

  // Handle editing a coaching point
  const handleEditCoachingPoint = useCallback(() =>
  {
    if (!selectedCoachingPoint) return;

    // Don't pass recording data for edit mode
    setRecordingData(null);
    setRecordingStartTimestamp(null);
    setShowCoachingPointModal(true);
  }, [selectedCoachingPoint]);

  // -----------------------------
  // Handlers: Recording controls
  // -----------------------------
  const { isRecording, startRecording, stopRecording } = useRecordingControls(
    videoPlayer,
    audioRecording,
    recordingSession,
    getDrawingData,
  );

  // -----------------------------
  // Handlers: Video controls
  // -----------------------------
  const { togglePlayPause, seekVideo, seekToTime, handlePlaybackRateChange } = useVideoControls(
    videoPlayer,
    isRecording,
    recordingSession,
    dismissCoachingPoint,
  );

  const handleToggleRecording = useCallback(async () =>
  {
    if (!isRecording)
    {
      const startTs = await startRecording();
      if (startTs !== null)
      {
        setRecordingStartTimestamp(startTs);
      }
    }
    else
    {
      const data = await stopRecording();
      if (data)
      {
        setRecordingData(data);
        setShowCoachingPointModal(true);
      }
    }
  }, [isRecording, startRecording, stopRecording]);

  // -----------------------------
  // Handlers: Flyout interactions
  // -----------------------------
  // Handle seeking to a coaching point timestamp
  const handleSeekToPoint = useCallback((timestampMs: string) =>
  {
    const timestamp = parseInt(timestampMs, 10) / 1000;

    // Use seekTo with allowSeekAhead set to true
    videoPlayer.seekTo(timestamp, true);
  }, [videoPlayer.seekTo]);

  // Handle showing drawings from a coaching point
  const handleShowDrawings = useCallback((drawings: Drawing[]) =>
  {
    setDrawingData(drawings);
  }, [setDrawingData]);

  // Handle pausing the video
  const handlePauseVideo = useCallback(() =>
  {
    if (!videoPlayer.isPlaying) return;

    videoPlayer.pauseVideo();
  }, [videoPlayer.isPlaying, videoPlayer.pauseVideo]);

  // -----------------------------
  // Hooks: Coaching point selection + playback start
  // -----------------------------
  // Encapsulate selection and playback start logic
  const {
    selectedCoachingPoint: selection_selectedCoachingPoint,
    currentViewEventId,
    selectCoachingPoint: handleSelectCoachingPoint,
    startCoachingPointPlayback: handleStartCoachingPointPlayback,
    startPlayback: handleStartPlayback,
  } = useCoachingPointSelection({
    videoPlayer,
    playback,
    clearCanvas,
    getPlaybackHandlers: (capturedViewEventId?: string) => playbackEventHandlers(capturedViewEventId),
    onStartFromFlyout: () => setPlaybackStartedFromFlyout(true),
  });

  // Keep local selectedCoachingPoint in sync with hook's state for minimal change footprint
  useEffect(() =>
  {
    setSelectedCoachingPoint(selection_selectedCoachingPoint);
  }, [selection_selectedCoachingPoint]);

  // -----------------------------
  // Helpers: Transport reset
  // -----------------------------
  const resetTransportControls = useCallback(() =>
  {
    if (!selectedCoachingPoint) return;

    // 1. Pause video if playing
    if (videoPlayer.getPlayerState() === 1)
    { // Playing
      videoPlayer.pauseVideo();
    }

    // 2. Set video to the beginning of the coaching point timestamp
    const coachingPointTimestamp = parseInt(selectedCoachingPoint.timestamp) / 1000; // Convert ms to seconds
    videoPlayer.seekTo(coachingPointTimestamp, true);

    // 3. Clear the canvas
    clearCanvas();

    // 4. Set playback to 1x speed
    videoPlayer.setPlaybackRate(1);

    // 5. Clear video playing state tracking
    wasVideoPlayingBeforePauseRef.current = false;
  }, [
    selectedCoachingPoint,
    clearCanvas,
    videoPlayer.getPlayerState,
    videoPlayer.pauseVideo,
    videoPlayer.seekTo,
    videoPlayer.setPlaybackRate,
  ]);

  // -----------------------------
  // Handlers: Playback events
  // -----------------------------
  const playbackEventHandlers = usePlaybackEventHandlers({
    videoPlayer,
    setDrawingData,
    resetTransportControls,
    currentViewEventId,
    resetFlyoutFlag: () => setPlaybackStartedFromFlyout(false),
    onComplete: (viewEventId, finalProgress) =>
    {
      try
      {
        updateViewCompletion(viewEventId, finalProgress);
      }
      catch (e)
      {
        console.warn('Failed to send view completion:', e);
      }
    },
  });

  // -----------------------------
  // Handlers: Playback controls
  // -----------------------------
  // Handle play/resume playback
  const handlePlayPlayback = useCallback(() =>
  {
    // Mark this as sidebar-initiated playback
    setPlaybackStartedFromFlyout(false);

    // Allow resume if:
    // 1. Standard case: currentTime > 0 AND currentTime < duration AND not playing
    // 2. Duration unknown case: currentTime > 0 AND duration is 0 AND not playing (audio element should have the actual position)
    if (
      playback.currentTime > 0 && !playback.isPlaying &&
      (playback.duration === 0 || playback.currentTime < playback.duration)
    )
    {
      // Resume if paused (but not if at the end)
      playback.resumePlayback();

      // Resume video if it was playing before we paused
      if (wasVideoPlayingBeforePauseRef.current && videoPlayer.getPlayerState() !== 1)
      {
        videoPlayer.playVideo();
      }
    }
    else
    {
      // Start fresh playback (or restart if at the end)
      handleStartPlayback();
    }
  }, [playback, handleStartPlayback, videoPlayer]);

  // Handle pause playback
  const handlePausePlayback = useCallback(() =>
  {
    // Remember if the video was playing before we pause
    if (videoPlayer.getPlayerState() === 1)
    { // Video is playing
      wasVideoPlayingBeforePauseRef.current = true;
      videoPlayer.pauseVideo();
    }
    else
    {
      wasVideoPlayingBeforePauseRef.current = false;
    }

    // Pause the coaching point audio
    playback.pausePlayback();
  }, [playback, videoPlayer.getPlayerState, videoPlayer.pauseVideo]);

  // Handle stopping playback
  const handleStopPlayback = useCallback(() =>
  {
    playback.stopPlayback();
    // Reset the flyout flag when stopping playback
    setPlaybackStartedFromFlyout(false);
    // Reset transport controls when manually stopping playback
    resetTransportControls();
  }, [playback, resetTransportControls]);

  // -----------------------------
  // Effects: Layout & recording capture
  // -----------------------------
  // Fullscreen change listeners handled by useFullscreen

  // Update video dimensions when sidebar state changes
  useEffect(() =>
  {
    if (videoPlayer.isReady && videoPlayer.updateVideoDimensions)
    {
      // Use a small delay to ensure CSS layout changes have been applied
      const timer = setTimeout(() =>
      {
        videoPlayer.updateVideoDimensions();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [selectedCoachingPoint, videoPlayer.isReady, videoPlayer.updateVideoDimensions]);

  // Capture drawing changes during recording
  useEffect(() =>
  {
    if (!isRecording) return;

    const interval = setInterval(() =>
    {
      const currentDrawings = getDrawingData();
      if (videoPlayer.videoDimensions)
      {
        // Record if drawings have changed (including when cleared to empty array)
        const drawingsChanged = JSON.stringify(currentDrawings) !== JSON.stringify(lastDrawingsRef.current);
        if (drawingsChanged)
        {
          recordingSession.recordDrawEvent(currentDrawings, {
            width: videoPlayer.videoDimensions.width,
            height: videoPlayer.videoDimensions.height,
          });
          lastDrawingsRef.current = [...currentDrawings];
        }
      }
    }, 4); // Capture every 4ms

    return () => clearInterval(interval);
  }, [isRecording, getDrawingData, videoPlayer.videoDimensions, recordingSession]);

  // -----------------------------
  // Effects: Auto-hide coordination
  // -----------------------------
  // When playback starts from flyout, hide immediately with grace; otherwise, restart timers
  useEffect(() =>
  {
    if (playback.isPlaying && playbackStartedFromFlyout)
    {
      applyImmediateHideWithGrace();
    }
    else if (playback.isPlaying && !playbackStartedFromFlyout)
    {
      startInactivityTimer();
    }
  }, [playback.isPlaying, playbackStartedFromFlyout, applyImmediateHideWithGrace, startInactivityTimer]);

  // -----------------------------
  // Hooks: Keyboard shortcuts
  // -----------------------------
  useGameAnalysisShortcuts({
    videoPlayer,
    video: {
      togglePlayPause,
      seekVideo,
      handlePlaybackRateChange,
    },
    drawing: {
      changeColor,
      changeMode,
      clearCanvas,
      undoLastDrawing,
    },
    ui: {
      showCoachingPointModal,
      isFlyoutExpanded,
      isPlaybackActive: playback.isPlaying,
      hasSelectedCoachingPoint: selectedCoachingPoint !== null,
    },
  });

  // =============================
  // Render
  // =============================
  if (!game.video_id)
  {
    return (
      <div className='game-analysis'>
        <GameHeader game={game} isFlyoutExpanded={isFlyoutExpanded} />
        <div className='error-state'>
          <h2>No Video Available</h2>
          <p>This game doesn't have a video URL. Please add a YouTube video URL to begin analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-analysis ${!isCursorVisible ? 'hide-cursor' : ''}`}>
      <GameHeader game={game} isFlyoutExpanded={isFlyoutExpanded} />

      <div className={`analysis-workspace ${selectedCoachingPoint ? 'with-sidebar' : ''}`}>
        <div
          className={`video-container ${selectedCoachingPoint ? 'with-sidebar' : ''} ${
            !isFlyoutExpanded ? 'flyout-collapsed' : ''
          }`}
        >
          <YouTubePlayer className={videoPlayer.isReady ? '' : 'loading'} />
          <DrawingCanvas
            canvasRef={canvasRef}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            videoDimensions={videoPlayer.videoDimensions}
          />

          <DrawingToolbar
            currentColor={currentColor}
            currentMode={currentMode}
            onColorChange={changeColor}
            onModeChange={changeMode}
            onClearCanvas={clearCanvas}
            onUndoLastDrawing={undoLastDrawing}
          />
        </div>

        {areBothUIElementsVisible && selectedCoachingPoint && (
          <CoachingPointSidebar
            point={selectedCoachingPoint as CoachingPoint}
            isCoach={game.user_role === 'coach'}
            onEdit={handleEditCoachingPoint}
            onClose={() => handleSelectCoachingPoint(null)}
            userRole={(game.user_role || 'player') as string}
            guardianPlayers={guardianPlayers}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
            isLoadingGuardianPlayers={isLoadingGuardianPlayers}
            guardianPlayersError={guardianPlayersError}
            acknowledgmentError={acknowledgmentError}
            acknowledgmentDate={acknowledgment.ack_at}
            acknowledgedValue={acknowledgedValue}
            notesValue={notesValue}
            isSavingAcknowledgment={isSavingAcknowledgment}
            hasUnsavedChanges={hasUnsavedChanges}
            saveSuccess={saveSuccess}
            onAcknowledgedChange={handleAcknowledgmentChange}
            onNotesChange={handleNotesChange}
            onSave={handleSaveAcknowledgment}
            showPlayback={!!selectedCoachingPoint.audio_url}
            playbackState={{
              isLoading: playback.isLoading,
              isPlaying: playback.isPlaying,
              error: playback.error,
              totalEvents: playback.totalEvents,
              duration: playback.duration,
              currentTime: playback.currentTime,
              progress: playback.progress,
            }}
            onPlay={handlePlayPlayback}
            onPause={handlePausePlayback}
            onStop={handleStopPlayback}
          />
        )}
      </div>

      {/* Coaching Point Modal */}
      <CoachingPointModal
        isOpen={showCoachingPointModal}
        onClose={() =>
        {
          setShowCoachingPointModal(false);
          setRecordingData(null);
          setRecordingStartTimestamp(null); // Reset recording start timestamp
        }}
        gameId={game.id}
        timestamp={recordingStartTimestamp !== null ? recordingStartTimestamp : videoPlayer.currentTime}
        drawingData={getDrawingData()}
        onCoachingPointCreated={handleCoachingPointCreated}
        onCoachingPointUpdated={handleCoachingPointUpdated}
        recordingData={recordingData}
        editMode={!!selectedCoachingPoint && !recordingData}
        existingCoachingPoint={selectedCoachingPoint && !recordingData ? selectedCoachingPoint : undefined}
      />

      {/* Coaching Points Flyout */}
      <CoachingPointsFlyout
        gameId={game.id}
        userRole={game.user_role}
        onSeekToPoint={handleSeekToPoint}
        onShowDrawings={handleShowDrawings}
        onPauseVideo={handlePauseVideo}
        onSelectCoachingPoint={handleSelectCoachingPoint}
        onStartCoachingPointPlayback={handleStartCoachingPointPlayback}
        refreshTrigger={coachingPointsRefresh}
        onExpandedChange={setIsFlyoutExpanded}
        isVisible={areBothUIElementsVisible}
        isPlaying={videoPlayer.isPlaying}
        currentTime={videoPlayer.currentTime}
        duration={videoPlayer.duration}
        currentPlaybackRate={(() =>
        {
          try
          {
            return videoPlayer.getPlaybackRate();
          }
          catch (error)
          {
            console.warn('Failed to get playback rate for flyout, using default:', error);
            return 1;
          }
        })()}
        onTogglePlayPause={togglePlayPause}
        onSeek={seekVideo}
        onSeekTo={seekToTime}
        onPlaybackRateChange={handlePlaybackRateChange}
        isCoachingPointPlaybackActive={playback.isPlaying ||
          (!!selectedCoachingPoint?.audio_url && playback.currentTime > 0)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onCreateCoachingPoint={handleCreateCoachingPoint}
        onToggleRecording={handleToggleRecording}
        isRecording={isRecording}
        isReady={videoPlayer.isReady}
        audioRecording={audioRecording}
        guardianPlayerIds={guardianPlayers.map(player => player.id)}
        selectedPlayerId={selectedPlayerId}
      />
    </div>
  );
};

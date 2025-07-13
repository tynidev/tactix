import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { useCoachingPointPlayback } from '../../hooks/useCoachingPointPlayback';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useRecordingSession } from '../../hooks/useRecordingSession';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';
import type { Drawing, RecordingStartEventData } from '../../types/drawing';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import DrawingToolbar from '../DrawingToolbar/DrawingToolbar';
import YouTubePlayer from '../YouTubePlayer/YouTubePlayer';
import './GameAnalysis.css';
import { FaArrowLeft, FaPause, FaPlay, FaSpinner, FaStop } from 'react-icons/fa';

interface Game
{
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
  user_role?: 'coach' | 'player' | 'admin' | 'guardian';
  teams?: {
    id: string;
    name: string;
  };
}

interface CoachingPointEvent
{
  id: string;
  event_type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed';
  timestamp: number;
  event_data: any;
  created_at: string;
}

interface CoachingPoint
{
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
  coaching_point_events?: CoachingPointEvent[];
}

interface GameAnalysisProps
{
  game: Game;
}

export const GameAnalysis: React.FC<GameAnalysisProps> = ({ game }) =>
{
  const [isRecording, setIsRecording] = useState(false);
  const [showCoachingPointModal, setShowCoachingPointModal] = useState(false);
  const [coachingPointsRefresh, setCoachingPointsRefresh] = useState(0);
  const [selectedCoachingPoint, setSelectedCoachingPoint] = useState<CoachingPoint | null>(null);
  const [isFlyoutExpanded, setIsFlyoutExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recordingData, setRecordingData] = useState<
    {
      audioBlob: Blob | null;
      recordingEvents: any[];
      recordingDuration: number;
    } | null
  >(null);
  const [recordingStartTimestamp, setRecordingStartTimestamp] = useState<number | null>(null);

  // Unified auto-hide system state
  const [areBothUIElementsVisible, setAreBothUIElementsVisible] = useState(true);
  const [isCursorVisible, setIsCursorVisible] = useState(true);

  // Add this ref to track previous drawings
  const lastDrawingsRef = useRef<Drawing[]>([]);

  // Track if video was playing when we paused coaching point playback
  const wasVideoPlayingBeforePauseRef = useRef<boolean>(false);

  // Unified auto-hide timer refs
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio recording functionality
  const audioRecording = useAudioRecording();

  // Recording session functionality
  const recordingSession = useRecordingSession();

  // Coaching point playback functionality
  const playback = useCoachingPointPlayback();

  // Unified auto-hide functionality with cursor hiding
  const startInactivityTimer = useCallback(() =>
  {
    // Clear existing timers
    if (inactivityTimerRef.current)
    {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (cursorTimerRef.current)
    {
      clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }

    // Start cursor timer (3 seconds - faster than UI elements)
    cursorTimerRef.current = setTimeout(() =>
    {
      setIsCursorVisible(false);
    }, 3000);

    // Start UI elements timer (5 seconds)
    inactivityTimerRef.current = setTimeout(() =>
    {
      setAreBothUIElementsVisible(false);
    }, 5000);
  }, []);

  const handleUserActivity = useCallback(() =>
  {
    // Make both UI elements and cursor visible again when there's activity
    setAreBothUIElementsVisible(true);
    setIsCursorVisible(true);

    // Clear grace period timer if active
    if (gracePeriodTimerRef.current)
    {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }

    // Restart the inactivity timers
    startInactivityTimer();
  }, [startInactivityTimer]);

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

  // Wrapped YouTube player controls to capture events during recording
  const togglePlayPause = useCallback(() =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    if (isRecording && player)
    {
      const currentVideoTime = player.getCurrentTime();
      const action = isPlaying ? 'pause' : 'play';
      recordingSession.recordPlayPauseEvent(action, currentVideoTime);
    }
    originalTogglePlayPause();
  }, [isRecording, player, isPlaying, recordingSession, originalTogglePlayPause, dismissCoachingPoint]);

  const seekVideo = useCallback((seconds: number) =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    if (isRecording && player)
    {
      const fromTime = player.getCurrentTime();
      const toTime = fromTime + seconds;
      recordingSession.recordSeekEvent(fromTime, toTime);
    }
    originalSeekVideo(seconds);
  }, [isRecording, player, recordingSession, originalSeekVideo, dismissCoachingPoint]);

  const seekToTime = useCallback((time: number) =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    if (isRecording && player)
    {
      const fromTime = player.getCurrentTime();
      recordingSession.recordSeekEvent(fromTime, time);
    }
    originalSeekToTime(time);
  }, [isRecording, player, recordingSession, originalSeekToTime, dismissCoachingPoint]);

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

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    setPlaybackRate(rate);

    // Record speed change event if recording
    if (isRecording)
    {
      recordingSession.recordChangeSpeedEvent(rate);
    }
  }, [setPlaybackRate, isRecording, recordingSession, dismissCoachingPoint]);

  // Handle creating a coaching point
  const handleCreateCoachingPoint = useCallback(() =>
  {
    if (!player) return;

    // Only allow creating coaching points when video is paused
    if (isPlaying)
    {
      alert('Please pause the video to add a coaching point.');
      return;
    }

    // Don't pass recording data for manual coaching points
    setRecordingData(null);
    setRecordingStartTimestamp(null); // Reset recording start timestamp for manual points
    setShowCoachingPointModal(true);
  }, [player, isPlaying]);

  // Handle when a coaching point is created successfully
  const handleCoachingPointCreated = useCallback(() =>
  {
    // Trigger a refresh of the coaching points flyout
    setCoachingPointsRefresh(prev => prev + 1);
  }, []);

  // Handle starting/stopping recording
  const handleToggleRecording = useCallback(async () =>
  {
    if (!isRecording)
    {
      // Start recording

      // Capture the current video timestamp before pausing
      const recordingStartTime = player ? player.getCurrentTime() : playerCurrentTime;

      // Pause video if playing
      if (isPlaying && player)
      {
        player.pauseVideo();
      }

      // Store the recording start timestamp
      setRecordingStartTimestamp(recordingStartTime);

      // Start audio recording
      const audioStarted = await audioRecording.startRecording();
      if (!audioStarted)
      {
        console.error('❌ Failed to start audio recording');
        setRecordingStartTimestamp(null); // Reset on failure
        return;
      }

      // Capture initial state for recording_start event
      let playbackSpeed = 1.0;
      try
      {
        if (player && typeof player.getPlaybackRate === 'function')
        {
          playbackSpeed = player.getPlaybackRate();
        }
      }
      catch (error)
      {
        console.warn('Failed to get playback rate, using default:', error);
      }

      const initialState: RecordingStartEventData = {
        playbackSpeed: playbackSpeed,
        videoTimestamp: recordingStartTime * 1000, // Convert to milliseconds
        existingDrawings: getDrawingData(), // Current canvas drawings
      };

      // Start recording session with initial state
      recordingSession.startRecordingSession(initialState);
      setIsRecording(true);
    }
    else
    {
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
  }, [isRecording, isPlaying, player, playerCurrentTime, audioRecording, recordingSession, getDrawingData]);

  // Handle seeking to a coaching point timestamp
  const handleSeekToPoint = useCallback((timestampMs: string) =>
  {
    if (!player) return;

    const timestamp = parseInt(timestampMs, 10) / 1000;

    // Use seekTo with allowSeekAhead set to true
    player.seekTo(timestamp, true);
  }, [player]);

  // Handle showing drawings from a coaching point
  const handleShowDrawings = useCallback((drawings: Drawing[]) =>
  {
    setDrawingData(drawings);
  }, [setDrawingData]);

  // Handle pausing the video
  const handlePauseVideo = useCallback(() =>
  {
    if (!player || !isPlaying) return;

    player.pauseVideo();
  }, [player, isPlaying]);

  // Handle selecting a coaching point
  const handleSelectCoachingPoint = useCallback((point: CoachingPoint | null) =>
  {
    // Stop any current playback when switching coaching points
    if (playback.isPlaying)
    {
      playback.stopPlayback();
    }
    setSelectedCoachingPoint(point);
  }, [playback]);

  // Reset transport controls to default state
  const resetTransportControls = useCallback(() =>
  {
    if (!player || !selectedCoachingPoint) return;

    // 1. Pause video if playing
    if (player.getPlayerState() === 1)
    { // Playing
      player.pauseVideo();
    }

    // 2. Set video to the beginning of the coaching point timestamp
    const coachingPointTimestamp = parseInt(selectedCoachingPoint.timestamp) / 1000; // Convert ms to seconds
    player.seekTo(coachingPointTimestamp, true);

    // 3. Clear the canvas
    clearCanvas();

    // 4. Set playback to 1x speed
    player.setPlaybackRate(1);

    // 5. Clear video playing state tracking
    wasVideoPlayingBeforePauseRef.current = false;
  }, [player, selectedCoachingPoint, clearCanvas]);

  // Playback event handlers for coaching_point_events during coaching point playback
  const playbackEventHandlers = useCallback(() => ({
    onPlayEvent: () =>
    {
      if (player && player.getPlayerState() !== 1)
      { // Not playing
        player.playVideo();
      }
    },
    onPauseEvent: () =>
    {
      if (player && player.getPlayerState() === 1)
      { // Playing
        player.pauseVideo();
      }
    },
    onSeekEvent: (time: number) =>
    {
      if (player)
      {
        player.seekTo(time, true);
      }
    },
    onDrawEvent: (drawings: Drawing[]) =>
    {
      setDrawingData(drawings);
    },
    onSpeedEvent: (speed: number) =>
    {
      if (player)
      {
        player.setPlaybackRate(speed);
      }
    },
    onRecordingStartEvent: (initialState: RecordingStartEventData) =>
    {
      // Set playback speed
      if (player && initialState.playbackSpeed)
      {
        player.setPlaybackRate(initialState.playbackSpeed);
      }

      // Set video timestamp (convert milliseconds to seconds)
      if (player && initialState.videoTimestamp !== undefined)
      {
        const timestampInSeconds = initialState.videoTimestamp / 1000;
        player.seekTo(timestampInSeconds, true);
      }

      // Set existing drawings
      if (initialState.existingDrawings)
      {
        setDrawingData(initialState.existingDrawings);
      }
    },
    onPlaybackComplete: () =>
    {
      // Reset transport controls when playback finishes naturally
      resetTransportControls();
    },
  }), [player, setDrawingData, resetTransportControls]);

  // Handle starting playback of a coaching point
  const handleStartPlayback = useCallback(() =>
  {
    if (!selectedCoachingPoint) return;

    const handlers = playbackEventHandlers();
    playback.startPlayback(selectedCoachingPoint, handlers);
  }, [selectedCoachingPoint, playback, playbackEventHandlers]);

  // Handle play/resume playback
  const handlePlayPlayback = useCallback(() =>
  {
    if (playback.currentTime > 0 && playback.currentTime < playback.duration && !playback.isPlaying)
    {
      // Resume if paused (but not if at the end)
      playback.resumePlayback();

      // Resume video if it was playing before we paused
      if (wasVideoPlayingBeforePauseRef.current && player && player.getPlayerState() !== 1)
      {
        player.playVideo();
      }
    }
    else
    {
      // Start fresh playback (or restart if at the end)
      handleStartPlayback();
    }
  }, [playback, handleStartPlayback, player]);

  // Handle pause playback
  const handlePausePlayback = useCallback(() =>
  {
    // Remember if the video was playing before we pause
    if (player && player.getPlayerState() === 1)
    { // Video is playing
      wasVideoPlayingBeforePauseRef.current = true;
      player.pauseVideo();
    }
    else
    {
      wasVideoPlayingBeforePauseRef.current = false;
    }

    // Pause the coaching point audio
    playback.pausePlayback();
  }, [playback, player]);

  // Handle stopping playback
  const handleStopPlayback = useCallback(() =>
  {
    playback.stopPlayback();
    // Reset transport controls when manually stopping playback
    resetTransportControls();
  }, [playback, resetTransportControls]);

  // Check if fullscreen API is supported
  const isFullscreenSupported = useCallback(() =>
  {
    return !!(
      document.documentElement.requestFullscreen ||
      (document.documentElement as any).webkitRequestFullscreen ||
      (document.documentElement as any).webkitRequestFullScreen ||
      (document.documentElement as any).msRequestFullscreen ||
      (document.documentElement as any).mozRequestFullScreen
    );
  }, []);

  // Handle fullscreen functionality
  const handleToggleFullscreen = useCallback(async () =>
  {
    // Check if fullscreen is supported
    if (!isFullscreenSupported())
    {
      console.warn('Fullscreen API is not supported on this device/browser');
      alert(
        'Fullscreen is not supported on this device. Try rotating your device to landscape mode for a better viewing experience.',
      );
      return;
    }

    try
    {
      if (!isFullscreen)
      {
        // Enter fullscreen
        const docEl = document.documentElement;
        if (docEl.requestFullscreen)
        {
          await docEl.requestFullscreen();
        }
        else if ((docEl as any).webkitRequestFullscreen)
        {
          // Safari desktop
          await (docEl as any).webkitRequestFullscreen();
        }
        else if ((docEl as any).webkitRequestFullScreen)
        {
          // Safari iOS (older versions)
          await (docEl as any).webkitRequestFullScreen();
        }
        else if ((docEl as any).msRequestFullscreen)
        {
          // IE/Edge
          await (docEl as any).msRequestFullscreen();
        }
        else if ((docEl as any).mozRequestFullScreen)
        {
          // Firefox
          await (docEl as any).mozRequestFullScreen();
        }
      }
      else
      {
        // Exit fullscreen
        if (document.exitFullscreen)
        {
          await document.exitFullscreen();
        }
        else if ((document as any).webkitExitFullscreen)
        {
          // Safari desktop
          await (document as any).webkitExitFullscreen();
        }
        else if ((document as any).webkitCancelFullScreen)
        {
          // Safari iOS (older versions)
          await (document as any).webkitCancelFullScreen();
        }
        else if ((document as any).msExitFullscreen)
        {
          // IE/Edge
          await (document as any).msExitFullscreen();
        }
        else if ((document as any).mozCancelFullScreen)
        {
          // Firefox
          await (document as any).mozCancelFullScreen();
        }
      }
    }
    catch (error)
    {
      console.warn('Fullscreen operation failed:', error);
      // On iOS Safari, fullscreen API often fails, provide helpful message
      if (/iPad|iPhone|iPod/.test(navigator.userAgent))
      {
        alert(
          "For the best viewing experience on iOS, please rotate your device to landscape mode and use Safari's built-in fullscreen by tapping the fullscreen icon in the video controls.",
        );
      }
    }
  }, [isFullscreen, isFullscreenSupported]);

  // Listen for fullscreen changes
  useEffect(() =>
  {
    const handleFullscreenChange = () =>
    {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).webkitCurrentFullScreenElement ||
        (document as any).msFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // Add event listeners for all browsers
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () =>
    {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update video dimensions when sidebar state changes
  useEffect(() =>
  {
    if (isReady && updateVideoDimensions)
    {
      // Use a small delay to ensure CSS layout changes have been applied
      const timer = setTimeout(() =>
      {
        updateVideoDimensions();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [selectedCoachingPoint, isReady, updateVideoDimensions]);

  // Capture drawing changes during recording
  useEffect(() =>
  {
    if (!isRecording) return;

    const interval = setInterval(() =>
    {
      const currentDrawings = getDrawingData();
      if (videoDimensions)
      {
        // Record if drawings have changed (including when cleared to empty array)
        const drawingsChanged = JSON.stringify(currentDrawings) !== JSON.stringify(lastDrawingsRef.current);
        if (drawingsChanged)
        {
          recordingSession.recordDrawEvent(currentDrawings, {
            width: videoDimensions.width,
            height: videoDimensions.height,
          });
          lastDrawingsRef.current = [...currentDrawings];
        }
      }
    }, 4); // Capture every 4ms

    return () => clearInterval(interval);
  }, [isRecording, getDrawingData, videoDimensions, recordingSession]);

  // Unified auto-hide system effects

  // Monitor coaching point playback for immediate hide + grace period
  useEffect(() =>
  {
    if (playback.isPlaying)
    {
      // Immediately hide both UI elements and cursor when audio starts
      setAreBothUIElementsVisible(false);
      setIsCursorVisible(false);

      // Clear any existing timers
      if (inactivityTimerRef.current)
      {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (cursorTimerRef.current)
      {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (gracePeriodTimerRef.current)
      {
        clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = null;
      }

      // Start grace period (1.5 seconds)
      gracePeriodTimerRef.current = setTimeout(() =>
      {
        // Grace period ended, activity detection will resume with next user activity
        gracePeriodTimerRef.current = null;
      }, 1500);
    }
  }, [playback.isPlaying]);

  // Document-level activity detection
  useEffect(() =>
  {
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((event) =>
    {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Start initial timer
    startInactivityTimer();

    return () =>
    {
      events.forEach((event) =>
      {
        document.removeEventListener(event, handleUserActivity);
      });

      // Cleanup timers
      if (inactivityTimerRef.current)
      {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (cursorTimerRef.current)
      {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (gracePeriodTimerRef.current)
      {
        clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = null;
      }
    };
  }, [handleUserActivity, startInactivityTimer]);

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
    disabled: showCoachingPointModal || isFlyoutExpanded || playback.isPlaying, // Disable shortcuts when modal is open, flyout is expanded, or playback is active
  });

  const formatTime = (seconds: number): string =>
  {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!game.video_id)
  {
    return (
      <div className='game-analysis'>
        {/* Circular Back Button */}
        <button onClick={() => window.history.back()} className='circular-back-button' title='Back'>
          <FaArrowLeft />
        </button>
        <div className='error-state'>
          <h2>No Video Available</h2>
          <p>This game doesn't have a video URL. Please add a YouTube video URL to begin analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-analysis ${!isCursorVisible ? 'hide-cursor' : ''}`}>
      {/* Circular Back Button */}
      <button onClick={() => window.history.back()} className='circular-back-button' title='Back'>
        <FaArrowLeft />
      </button>

      <div className={`analysis-workspace ${selectedCoachingPoint ? 'with-sidebar' : ''}`}>
        <div
          className={`video-container ${selectedCoachingPoint ? 'with-sidebar' : ''} ${
            !isFlyoutExpanded ? 'flyout-collapsed' : ''
          }`}
        >
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

        {areBothUIElementsVisible && selectedCoachingPoint && (
          <div className={`coaching-point-sidebar ${playback.isPlaying ? 'playback-active' : ''}`}>
            <div className='sidebar-header'>
              <h3>Coaching Point Details</h3>
              <button
                onClick={() =>
                  handleSelectCoachingPoint(null)}
                className='btn btn-secondary btn-sm'
                title='Close details'
              >
                ✕
              </button>
            </div>
            <div className='sidebar-content'>
              <div className='coaching-point-details'>
                <h4 className='point-title'>{selectedCoachingPoint.title}</h4>
                <div className='point-meta'>
                  <span className='point-timestamp'>
                    {formatTime(parseInt(selectedCoachingPoint.timestamp) / 1000)}
                  </span>
                  <span className='point-author'>
                    by {selectedCoachingPoint.author?.name || 'Unknown'}
                  </span>
                </div>
                <div className='point-feedback'>
                  <h5>Feedback:</h5>
                  <p>{selectedCoachingPoint.feedback}</p>
                </div>
                {selectedCoachingPoint.coaching_point_tagged_players &&
                  selectedCoachingPoint.coaching_point_tagged_players.length > 0 && (
                  <div>
                    <h5 style={{ margin: '6px 0px 0px 0px' }}>Tagged Players:</h5>
                    <div className='point-players'>
                      <div className='player-tags'>
                        {selectedCoachingPoint.coaching_point_tagged_players.map((taggedPlayer) => (
                          <span key={taggedPlayer.id} className='player-tag'>
                            {taggedPlayer.player_profiles.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {selectedCoachingPoint.coaching_point_labels &&
                  selectedCoachingPoint.coaching_point_labels.length > 0 && (
                  <div>
                    <h5 style={{ margin: '6px 0px 0px 0px' }}>Labels:</h5>
                    <div className='point-labels'>
                      <div className='label-tags'>
                        {selectedCoachingPoint.coaching_point_labels.map((labelAssignment) => (
                          <span key={labelAssignment.id} className='label-tag'>
                            {labelAssignment.labels.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Playback Controls - Only show if audio is available */}
                {selectedCoachingPoint.audio_url && (
                  <div className='playback-controls'>
                    <h5>Playback Recording:</h5>

                    {/* Event Count Display */}
                    {playback.totalEvents > 0 && (
                      <div className='event-info'>
                        <span className='event-count'>
                          📽️ {playback.totalEvents} recorded events
                        </span>
                      </div>
                    )}

                    {/* Error Display */}
                    {playback.error && (
                      <div className='playback-error'>
                        ❌ {playback.error}
                      </div>
                    )}

                    {/* Loading State */}
                    {playback.isLoading && (
                      <div className='playback-loading'>
                        ⏳ Loading audio...
                      </div>
                    )}

                    {/* Progress Bar */}
                    {playback.duration > 0 && (
                      <div className='progress-container'>
                        <div className='progress-bar'>
                          <div
                            className='progress-fill'
                            style={{ width: `${playback.progress}%` }}
                          />
                        </div>
                        <div className='time-display'>
                          {formatTime(playback.currentTime)} / {formatTime(playback.duration)}
                        </div>
                      </div>
                    )}

                    {/* Control Buttons */}
                    <div className='playback-buttons'>
                      <button
                        onClick={handlePlayPlayback}
                        className='btn btn-success'
                        disabled={playback.isLoading || !selectedCoachingPoint.audio_url || playback.isPlaying}
                        title='Start or resume playback'
                      >
                        {playback.isLoading ? <FaSpinner className='spinning' /> : <FaPlay />}
                      </button>

                      <button
                        onClick={handlePausePlayback}
                        className='btn btn-warning'
                        disabled={!playback.isPlaying}
                        title='Pause playback'
                      >
                        <FaPause />
                      </button>

                      <button
                        onClick={handleStopPlayback}
                        className='btn btn-error'
                        disabled={!playback.isPlaying && playback.currentTime === 0}
                        title='Stop playback and reset'
                      >
                        <FaStop />
                      </button>
                    </div>

                    {/* Playback Status */}
                    {(playback.isPlaying || playback.currentTime > 0) && (
                      <div className='playback-status'>
                        {playback.isPlaying ?
                          <span className='status-playing'>🎵 Playing coaching session...</span> :
                          playback.currentTime > 0 ?
                          <span className='status-paused'>⏸️ Playback paused</span> :
                          null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
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
        timestamp={recordingStartTimestamp !== null ? recordingStartTimestamp : playerCurrentTime}
        drawingData={getDrawingData()}
        onCoachingPointCreated={handleCoachingPointCreated}
        recordingData={recordingData}
      />

      {/* Coaching Points Flyout */}
      <CoachingPointsFlyout
        gameId={game.id}
        userRole={game.user_role}
        onSeekToPoint={handleSeekToPoint}
        onShowDrawings={handleShowDrawings}
        onPauseVideo={handlePauseVideo}
        onSelectCoachingPoint={handleSelectCoachingPoint}
        refreshTrigger={coachingPointsRefresh}
        onExpandedChange={setIsFlyoutExpanded}
        isVisible={areBothUIElementsVisible}
        isPlaying={isPlaying}
        currentTime={playerCurrentTime}
        duration={duration}
        currentPlaybackRate={(() =>
        {
          try
          {
            return (player && typeof player.getPlaybackRate === 'function') ? player.getPlaybackRate() : 1;
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
        isReady={isReady}
        audioRecording={audioRecording}
      />
    </div>
  );
};

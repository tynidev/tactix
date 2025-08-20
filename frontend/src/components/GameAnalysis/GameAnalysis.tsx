import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { useCoachingPointPlayback } from '../../hooks/useCoachingPointPlayback';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useRecordingSession } from '../../hooks/useRecordingSession';
import type { Drawing, RecordingStartEventData } from '../../types/drawing';
import {
  getCoachingPointAcknowledgment,
  getGuardianPlayers,
  recordCoachingPointView,
  updateCoachingPointAcknowledgment,
  updateViewCompletion,
} from '../../utils/api';
import { createVideoPlayer } from '../../utils/videoPlayerFactory';
import { CoachingPointModal } from '../CoachingPointModal/CoachingPointModal';
import { CoachingPointsFlyout } from '../CoachingPointsFlyout/CoachingPointsFlyout';
import DrawingCanvas from '../DrawingCanvas/DrawingCanvas';
import DrawingToolbar from '../DrawingToolbar/DrawingToolbar';
import YouTubePlayer from '../YouTubePlayer/YouTubePlayer';
import './GameAnalysis.css';
import { FaArrowLeft, FaCheck, FaPause, FaPlay, FaSpinner, FaStop } from 'react-icons/fa';

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

  // Acknowledgment state
  const [acknowledgment, setAcknowledgment] = useState<{
    acknowledged: boolean;
    ack_at: string | null;
    notes: string | null;
  }>({ acknowledged: false, ack_at: null, notes: null });
  const [notesValue, setNotesValue] = useState('');
  const [acknowledgedValue, setAcknowledgedValue] = useState(false);
  const [isSavingAcknowledgment, setIsSavingAcknowledgment] = useState(false);
  const [acknowledgmentError, setAcknowledmentError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Guardian player selection state
  const [guardianPlayers, setGuardianPlayers] = useState<{ id: string; name: string; jersey_number: string | null; }[]>(
    [],
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isLoadingGuardianPlayers, setIsLoadingGuardianPlayers] = useState(false);
  const [guardianPlayersError, setGuardianPlayersError] = useState<string | null>(null);

  // Unified auto-hide system state
  const [areBothUIElementsVisible, setAreBothUIElementsVisible] = useState(true);
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const [playbackStartedFromFlyout, setPlaybackStartedFromFlyout] = useState(false);

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

  // Direct view tracking state (replacing useCoachingPointView hook)
  const [currentViewEventId, setCurrentViewEventId] = useState<string | null>(null);

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

    if (isRecording)
    {
      const currentVideoTime = videoPlayer.getCurrentTime();
      const action = videoPlayer.isPlaying ? 'pause' : 'play';
      recordingSession.recordPlayPauseEvent(action, currentVideoTime);
    }
    videoPlayer.togglePlayPause();
  }, [
    isRecording,
    videoPlayer,
    videoPlayer.isPlaying,
    recordingSession,
    videoPlayer.togglePlayPause,
    dismissCoachingPoint,
  ]);

  const seekVideo = useCallback((seconds: number) =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    if (isRecording)
    {
      const fromTime = videoPlayer.getCurrentTime();
      const toTime = fromTime + seconds;
      recordingSession.recordSeekEvent(fromTime, toTime);
    }
    videoPlayer.seekVideo(seconds);
  }, [isRecording, videoPlayer, recordingSession, dismissCoachingPoint]);

  const seekToTime = useCallback((time: number) =>
  {
    // Dismiss coaching point if one is active
    dismissCoachingPoint();

    if (isRecording)
    {
      const fromTime = videoPlayer.getCurrentTime();
      recordingSession.recordSeekEvent(fromTime, time);
    }
    videoPlayer.seekToTime(time);
  }, [isRecording, videoPlayer, recordingSession, dismissCoachingPoint]);

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

    videoPlayer.setPlaybackRate(rate);

    // Record speed change event if recording
    if (isRecording)
    {
      recordingSession.recordChangeSpeedEvent(rate);
    }
  }, [videoPlayer.setPlaybackRate, isRecording, recordingSession, dismissCoachingPoint]);

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

  // Handle starting/stopping recording
  const handleToggleRecording = useCallback(async () =>
  {
    if (!isRecording)
    {
      // Start recording

      // Capture the current video timestamp before pausing
      const recordingStartTime = videoPlayer.getCurrentTime();

      // Pause video if playing
      if (videoPlayer.isPlaying)
      {
        videoPlayer.pauseVideo();
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
        playbackSpeed = videoPlayer.getPlaybackRate();
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
  }, [
    isRecording,
    videoPlayer.isPlaying,
    videoPlayer,
    videoPlayer.currentTime,
    audioRecording,
    recordingSession,
    getDrawingData,
  ]);

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

  // Handle selecting a coaching point
  const handleSelectCoachingPoint = useCallback(async (point: CoachingPoint | null) =>
  {
    // Stop any current playback when switching coaching points
    if (playback.isPlaying)
    {
      playback.stopPlayback();
    }

    // Clear canvas when closing the coaching point sidebar (point is null)
    if (!point && selectedCoachingPoint)
    {
      clearCanvas();
    }

    if (point && !point.audio_url)
    {
      await recordCoachingPointView(point.id, 100);
    }

    setSelectedCoachingPoint(point);
  }, [playback, selectedCoachingPoint, clearCanvas]);

  // Load guardian players for non-player roles (coach, admin, guardian)
  useEffect(() =>
  {
    if (game.user_role === 'player' || !game.teams?.id) return;

    const loadGuardianPlayers = async () =>
    {
      try
      {
        setIsLoadingGuardianPlayers(true);
        setGuardianPlayersError(null);
        const players = await getGuardianPlayers(game.teams!.id);
        setGuardianPlayers(players);

        // Auto-select first player if any players exist
        if (players.length > 0)
        {
          setSelectedPlayerId(players[0].id);
        }
      }
      catch (error)
      {
        console.error('Failed to load guardian players:', error);
        setGuardianPlayersError('Failed to load your players');
      }
      finally
      {
        setIsLoadingGuardianPlayers(false);
      }
    };

    loadGuardianPlayers();
  }, [game.user_role, game.teams?.id]);

  // Load acknowledgment data when a coaching point is selected
  useEffect(() =>
  {
    if (!selectedCoachingPoint || (game.user_role !== 'player' && guardianPlayers.length === 0)) return;

    const loadAcknowledgment = async () =>
    {
      try
      {
        setAcknowledmentError(null);
        setSaveSuccess(false);
        setHasUnsavedChanges(false);

        // For non-player roles, use the selected player ID
        const playerId = game.user_role !== 'player' ? selectedPlayerId || undefined : undefined;

        if (game.user_role !== 'player' && !playerId)
        {
          // Non-player hasn't selected a player yet, don't load acknowledgment
          setAcknowledgment({ acknowledged: false, ack_at: null, notes: null });
          setNotesValue('');
          setAcknowledgedValue(false);
          return;
        }

        const ackData = await getCoachingPointAcknowledgment(selectedCoachingPoint.id, playerId);
        setAcknowledgment(ackData);
        setNotesValue(ackData.notes || '');
        setAcknowledgedValue(ackData.acknowledged);
      }
      catch (error)
      {
        console.error('Failed to load acknowledgment:', error);
        setAcknowledmentError('Failed to load acknowledgment data');
      }
    };

    loadAcknowledgment();
  }, [selectedCoachingPoint, game.user_role, selectedPlayerId]);

  // Track changes to show unsaved indicator
  useEffect(() =>
  {
    if (!selectedCoachingPoint) return;

    const hasChanges = acknowledgedValue !== acknowledgment.acknowledged ||
      notesValue !== (acknowledgment.notes || '');

    setHasUnsavedChanges(hasChanges);

    // Clear success message when user makes changes
    if (hasChanges && saveSuccess)
    {
      setSaveSuccess(false);
    }
  }, [
    acknowledgedValue,
    notesValue,
    acknowledgment.acknowledged,
    acknowledgment.notes,
    selectedCoachingPoint,
    saveSuccess,
  ]);

  // Handle acknowledgment checkbox change (no auto-save)
  const handleAcknowledgmentChange = useCallback((acknowledged: boolean) =>
  {
    setAcknowledgedValue(acknowledged);
  }, []);

  // Handle notes change (no auto-save)
  const handleNotesChange = useCallback((notes: string) =>
  {
    setNotesValue(notes);
  }, []);

  // Handle explicit save
  const handleSaveAcknowledgment = useCallback(async () =>
  {
    if (!selectedCoachingPoint) return;

    // For non-player roles, ensure a player is selected
    if (game.user_role !== 'player' && !selectedPlayerId)
    {
      setAcknowledmentError('Please select a player first');
      return;
    }

    try
    {
      setIsSavingAcknowledgment(true);
      setAcknowledmentError(null);
      setSaveSuccess(false);

      // For non-player roles, pass the selected player ID
      const playerId = game.user_role !== 'player' ? selectedPlayerId || undefined : undefined;

      // Auto-acknowledge if notes are provided
      const shouldAcknowledge = acknowledgedValue || !!(notesValue && notesValue.trim().length > 0);

      const result = await updateCoachingPointAcknowledgment(
        selectedCoachingPoint.id,
        shouldAcknowledge,
        notesValue || undefined,
        playerId,
      );

      setAcknowledgment(result);
      setAcknowledgedValue(result.acknowledged); // Update checkbox state to reflect saved value
      setHasUnsavedChanges(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    catch (error)
    {
      console.error('Failed to update acknowledgment:', error);
      setAcknowledmentError('Failed to save acknowledgment');
    }
    finally
    {
      setIsSavingAcknowledgment(false);
    }
  }, [selectedCoachingPoint, acknowledgedValue, notesValue, game.user_role, selectedPlayerId]);

  // Reset transport controls to default state
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

  // Playback event handlers for coaching_point_events during coaching point playback
  const playbackEventHandlers = useCallback((capturedViewEventId?: string) => ({
    onPlayEvent: () =>
    {
      if (videoPlayer.getPlayerState() !== 1)
      { // Not playing
        videoPlayer.playVideo();
      }
    },
    onPauseEvent: () =>
    {
      if (videoPlayer.getPlayerState() === 1)
      { // Playing
        videoPlayer.pauseVideo();
      }
    },
    onSeekEvent: (time: number) =>
    {
      videoPlayer.seekTo(time, true);
    },
    onDrawEvent: (drawings: Drawing[]) =>
    {
      setDrawingData(drawings);
    },
    onSpeedEvent: (speed: number) =>
    {
      videoPlayer.setPlaybackRate(speed);
    },
    onRecordingStartEvent: (initialState: RecordingStartEventData) =>
    {
      // Pause video
      videoPlayer.pauseVideo();

      // Set playback speed
      if (initialState.playbackSpeed)
      {
        videoPlayer.setPlaybackRate(initialState.playbackSpeed);
      }

      // Set video timestamp (convert milliseconds to seconds)
      if (initialState.videoTimestamp !== undefined)
      {
        const timestampInSeconds = initialState.videoTimestamp / 1000;
        videoPlayer.seekTo(timestampInSeconds, true);
      }

      // Set existing drawings
      if (initialState.existingDrawings)
      {
        setDrawingData(initialState.existingDrawings);
      }
    },
    onPlaybackComplete: (reason: 'natural' | 'manual', currentProgress: number) =>
    {
      // Use captured view event ID to avoid race condition
      const viewEventId = capturedViewEventId || currentViewEventId;
      if (viewEventId)
      {
        try
        {
          // For natural completion, send 100%. For manual stop, send actual progress
          const finalProgress = reason === 'natural' ? 100 : Math.round(currentProgress);
          updateViewCompletion(viewEventId, finalProgress);
        }
        catch (e)
        {
          console.warn('Failed to send view completion:', e);
        }
      }

      // Reset the flyout flag when playback completes
      setPlaybackStartedFromFlyout(false);
      // Reset transport controls when playback finishes
      resetTransportControls();
    },
  }), [
    videoPlayer.getPlayerState,
    videoPlayer.playVideo,
    videoPlayer.pauseVideo,
    videoPlayer.seekTo,
    videoPlayer.setPlaybackRate,
    setDrawingData,
    resetTransportControls,
    currentViewEventId,
  ]);

  // Handle auto-starting coaching point playback when clicked in flyout
  const handleStartCoachingPointPlayback = useCallback(async (point: CoachingPoint) =>
  {
    if (!point) return;

    // Pause video
    videoPlayer.pauseVideo();

    // Ensure the point is selected first (this should already be done by handleSelectCoachingPoint)
    setSelectedCoachingPoint(point);

    // Mark this as flyout-initiated playback
    setPlaybackStartedFromFlyout(true);

    // Always record a new view when starting playback from flyout
    let capturedViewEventId: string | undefined;
    if (point.audio_url)
    {
      try
      {
        // Direct API call to record view
        const response = await recordCoachingPointView(point.id, 0);
        capturedViewEventId = response.eventId;
        setCurrentViewEventId(capturedViewEventId);
      }
      catch (error)
      {
        console.error('Failed to start view tracking for flyout playback:', error);
      }
    }

    // Start playback using the existing handler with captured view event ID
    const handlers = playbackEventHandlers(capturedViewEventId);
    playback.startPlayback(point, handlers);
  }, [playback, playbackEventHandlers]);

  // Handle starting playback of a coaching point
  const handleStartPlayback = useCallback(async () =>
  {
    if (!selectedCoachingPoint) return;

    // Pause video
    videoPlayer.pauseVideo();

    // Always record a new view when starting fresh playback
    let capturedViewEventId: string | undefined;
    if (selectedCoachingPoint.audio_url)
    {
      try
      {
        // Direct API call to record view
        const response = await recordCoachingPointView(selectedCoachingPoint.id, 0);
        capturedViewEventId = response.eventId;
        setCurrentViewEventId(capturedViewEventId);
      }
      catch (error)
      {
        console.error('Failed to start view tracking for manual playback:', error);
      }
    }

    const handlers = playbackEventHandlers(capturedViewEventId);
    playback.startPlayback(selectedCoachingPoint, handlers);
  }, [selectedCoachingPoint, playback, playbackEventHandlers]);

  // Track audio playback progress for view completion
  // Note: Avoid depending on rapidly changing values (currentTime/duration) so the interval can actually fire.
  const playbackTimeRef = useRef({ currentTime: 0, duration: 0 });
  const lastReportedPercentRef = useRef<number>(0);

  // Keep refs in sync with latest playback times
  useEffect(() =>
  {
    playbackTimeRef.current.currentTime = playback.currentTime;
  }, [playback.currentTime]);

  useEffect(() =>
  {
    playbackTimeRef.current.duration = playback.duration;
  }, [playback.duration]);

  useEffect(() =>
  {
    if (!selectedCoachingPoint?.audio_url || !playback.isPlaying || !currentViewEventId) return;
    // Initialize baseline to current progress to avoid resending earlier percentages on resume
    const { currentTime, duration } = playbackTimeRef.current;
    lastReportedPercentRef.current = duration > 0 ?
      Math.max(0, Math.min(100, Math.floor((currentTime / duration) * 100))) :
      0;

    const intervalId = setInterval(() =>
    {
      const { currentTime, duration } = playbackTimeRef.current;
      if (duration > 0 && currentTime >= 0 && currentViewEventId)
      {
        const percent = Math.min(100, Math.floor((currentTime / duration) * 100));
        if (percent > lastReportedPercentRef.current)
        {
          lastReportedPercentRef.current = percent;
          // Direct API call for progress updates
          updateViewCompletion(currentViewEventId, percent);
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, [selectedCoachingPoint?.audio_url, playback.isPlaying, currentViewEventId]);

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

  // Unified auto-hide system effects

  // Monitor coaching point playback for immediate hide + grace period
  useEffect(() =>
  {
    if (playback.isPlaying && playbackStartedFromFlyout)
    {
      // Only immediately hide UI elements and cursor when playback started from flyout
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
    else if (playback.isPlaying && !playbackStartedFromFlyout)
    {
      // For sidebar-initiated playback, just restart the normal inactivity timer
      // This allows the UI to remain visible and follow normal auto-hide behavior
      startInactivityTimer();
    }
  }, [playback.isPlaying, playbackStartedFromFlyout, startInactivityTimer]);

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
    videoPlayer,
    togglePlayPause,
    seekVideo,
    setPlaybackRate: handlePlaybackRateChange,
    changeColor,
    changeMode,
    clearCanvas,
    undoLastDrawing,
    disabled: showCoachingPointModal || isFlyoutExpanded || playback.isPlaying || selectedCoachingPoint !== null, // Disable shortcuts when modal is open, flyout is expanded, playback is active, or coaching point is selected
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

                {/* Player Acknowledgment Section */}
                {(game.user_role === 'player' || guardianPlayers.length > 0) && (
                  <div className='acknowledgment-section'>
                    <h5>Acknowledgment:</h5>

                    {/* Player Selection for non-player roles */}
                    {game.user_role !== 'player' && guardianPlayers.length > 0 && (
                      <div className='guardian-player-selection'>
                        <label htmlFor='player-select'>Acknowledge for:</label>
                        {isLoadingGuardianPlayers ?
                          (
                            <div className='loading-players'>
                              <FaSpinner className='spinning' /> Loading your players...
                            </div>
                          ) :
                          guardianPlayersError ?
                          (
                            <div className='players-error'>
                              ❌ {guardianPlayersError}
                            </div>
                          ) :
                          guardianPlayers.length === 1 ?
                          (
                            <div className='single-player-display'>
                              <strong>
                                {guardianPlayers[0].name}
                                {guardianPlayers[0].jersey_number && ` (#${guardianPlayers[0].jersey_number})`}
                              </strong>
                            </div>
                          ) :
                          (
                            <select
                              id='player-select'
                              value={selectedPlayerId || ''}
                              onChange={(e) => setSelectedPlayerId(e.target.value || null)}
                              disabled={isSavingAcknowledgment}
                            >
                              {guardianPlayers.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                  {player.jersey_number && ` (#${player.jersey_number})`}
                                </option>
                              ))}
                            </select>
                          )}
                      </div>
                    )}

                    {acknowledgmentError && (
                      <div className='acknowledgment-error'>
                        ❌ {acknowledgmentError}
                      </div>
                    )}

                    <div className='acknowledgment-controls'>
                      <label className='acknowledgment-checkbox'>
                        <input
                          type='checkbox'
                          checked={acknowledgedValue}
                          onChange={(e) => handleAcknowledgmentChange(e.target.checked)}
                          disabled={isSavingAcknowledgment}
                        />
                        <span className='checkmark'>
                          {acknowledgedValue && <FaCheck />}
                        </span>
                        <span className='checkbox-label'>
                          I have watched and understood this coaching point
                        </span>
                      </label>

                      {acknowledgment.ack_at && (
                        <div className='acknowledgment-date'>
                          Acknowledged on {new Date(acknowledgment.ack_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className='notes-section'>
                      <label htmlFor='acknowledgment-notes'>Notes (optional):</label>
                      <textarea
                        id='acknowledgment-notes'
                        value={notesValue}
                        onChange={(e) => handleNotesChange(e.target.value)}
                        placeholder='What did you learn from this coaching point? (1024 characters max)'
                        maxLength={1024}
                        rows={3}
                        disabled={isSavingAcknowledgment}
                      />
                      <div className='character-count'>
                        {notesValue.length}/1024 characters
                      </div>
                    </div>

                    {/* Save Button and Status */}
                    <div className='save-section'>
                      <button
                        onClick={handleSaveAcknowledgment}
                        className={`btn ${hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'}`}
                        disabled={isSavingAcknowledgment || !hasUnsavedChanges}
                        title={hasUnsavedChanges ? 'Save acknowledgment and notes' : 'No changes to save'}
                      >
                        {isSavingAcknowledgment ?
                          (
                            <>
                              <FaSpinner className='spinning' /> Saving...
                            </>
                          ) :
                          (
                            <>
                              <FaCheck /> Save
                            </>
                          )}
                      </button>

                      {hasUnsavedChanges && !isSavingAcknowledgment && (
                        <div className='unsaved-changes'>
                          ⚠️ You have unsaved changes
                        </div>
                      )}

                      {saveSuccess && (
                        <div className='save-success'>
                          ✅ Saved successfully!
                        </div>
                      )}
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
        timestamp={recordingStartTimestamp !== null ? recordingStartTimestamp : videoPlayer.currentTime}
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
      />
    </div>
  );
};

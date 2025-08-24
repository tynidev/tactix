import { useCallback, useEffect, useRef, useState } from 'react';
import { recordCoachingPointView, updateViewCompletion } from '../../../utils/api';
import type { CoachingPoint } from '../types/gameAnalysisTypes';

interface VideoPlayerLike
{
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

interface PlaybackLike
{
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  totalEvents: number;
  duration: number;
  currentTime: number;
  progress: number;
  startPlayback: (point: CoachingPoint, handlers: any) => void;
}

export function useCoachingPointSelection({
  videoPlayer,
  playback,
  clearCanvas,
  getPlaybackHandlers,
  onStartFromFlyout,
}: {
  videoPlayer: VideoPlayerLike;
  playback: PlaybackLike;
  clearCanvas: () => void;
  getPlaybackHandlers: (capturedViewEventId?: string) => any;
  onStartFromFlyout?: () => void;
})
{
  const [selectedCoachingPoint, setSelectedCoachingPoint] = useState<CoachingPoint | null>(null);
  const [currentViewEventId, setCurrentViewEventId] = useState<string | null>(null);

  // Refs to avoid effect churn
  const playbackTimeRef = useRef({ currentTime: 0, duration: 0 });
  const lastReportedPercentRef = useRef(0);

  // Keep refs in sync
  useEffect(() =>
  {
    playbackTimeRef.current.currentTime = playback.currentTime;
  }, [playback.currentTime]);

  useEffect(() =>
  {
    playbackTimeRef.current.duration = playback.duration;
  }, [playback.duration]);

  // Public: select or clear a coaching point
  const selectCoachingPoint = useCallback(
    async (point: CoachingPoint | null) =>
    {
      // If switching away, stop playback
      if (playback.isPlaying)
      {
        // No direct stop method here; selection is usually cleared prior to stop by caller
        // This hook focuses on selection; caller controls stop/reset when needed
      }

      // Clear canvas when closing sidebar
      if (!point && selectedCoachingPoint)
      {
        clearCanvas();
      }

      // Instant view record for non-audio points
      if (point && !point.audio_url)
      {
        try
        {
          await recordCoachingPointView(point.id, 100);
        }
        catch (e)
        {
          console.warn('Failed to record instant view for non-audio point', e);
        }
      }

      setSelectedCoachingPoint(point);
    },
    [playback.isPlaying, selectedCoachingPoint, clearCanvas],
  );

  // Start playback when clicked in flyout
  const startCoachingPointPlayback = useCallback(
    async (point: CoachingPoint) =>
    {
      if (!point) return;

      // Pause video
      videoPlayer.pauseVideo();

      // Ensure selection
      setSelectedCoachingPoint(point);

      // Notify for UI behavior (e.g., auto-hide)
      onStartFromFlyout?.();

      // Start view tracking
      let capturedViewEventId: string | undefined;
      if (point.audio_url)
      {
        try
        {
          const response = await recordCoachingPointView(point.id, 0);
          capturedViewEventId = response.eventId;
          setCurrentViewEventId(capturedViewEventId);
        }
        catch (error)
        {
          console.error('Failed to start view tracking for flyout playback:', error);
        }
      }

      const handlers = getPlaybackHandlers(capturedViewEventId);
      playback.startPlayback(point, handlers);
    },
    [videoPlayer, getPlaybackHandlers, playback, onStartFromFlyout],
  );

  // Start playback from sidebar for current selection
  const startPlayback = useCallback(async () =>
  {
    if (!selectedCoachingPoint) return;

    // Pause video
    videoPlayer.pauseVideo();

    let capturedViewEventId: string | undefined;
    if (selectedCoachingPoint.audio_url)
    {
      try
      {
        const response = await recordCoachingPointView(selectedCoachingPoint.id, 0);
        capturedViewEventId = response.eventId;
        setCurrentViewEventId(capturedViewEventId);
      }
      catch (error)
      {
        console.error('Failed to start view tracking for manual playback:', error);
      }
    }

    const handlers = getPlaybackHandlers(capturedViewEventId);
    playback.startPlayback(selectedCoachingPoint, handlers);
  }, [selectedCoachingPoint, videoPlayer, getPlaybackHandlers, playback]);

  // Progress reporting: update view completion while playing
  useEffect(() =>
  {
    if (!selectedCoachingPoint?.audio_url || !playback.isPlaying || !currentViewEventId) return;

    // Initialize baseline to current progress
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
          updateViewCompletion(currentViewEventId, percent);
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [selectedCoachingPoint?.audio_url, playback.isPlaying, currentViewEventId]);

  return {
    selectedCoachingPoint,
    setSelectedCoachingPoint,
    currentViewEventId,
    selectCoachingPoint,
    startCoachingPointPlayback,
    startPlayback,
  } as const;
}

import { useCallback } from 'react';
import type { Drawing, RecordingStartEventData } from '../../../types/drawing';

interface VideoPlayerLike
{
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

export function usePlaybackEventHandlers({
  videoPlayer,
  setDrawingData,
  resetTransportControls,
  currentViewEventId,
  resetFlyoutFlag,
  onComplete,
}: {
  videoPlayer: VideoPlayerLike;
  setDrawingData: (drawings: Drawing[]) => void;
  resetTransportControls: () => void;
  currentViewEventId: string | null;
  resetFlyoutFlag: () => void;
  onComplete: (viewEventId: string, finalProgress: number) => void;
})
{
  return useCallback(
    (capturedViewEventId?: string) => ({
      onPlayEvent: () =>
      {
        if (videoPlayer.getPlayerState() !== 1)
        {
          videoPlayer.playVideo();
        }
      },
      onPauseEvent: () =>
      {
        if (videoPlayer.getPlayerState() === 1)
        {
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

        // Set video timestamp (convert ms to seconds)
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
        const viewEventId = capturedViewEventId || currentViewEventId || undefined;
        if (viewEventId)
        {
          const finalProgress = reason === 'natural' ? 100 : Math.round(currentProgress);
          onComplete(viewEventId, finalProgress);
        }
        resetFlyoutFlag();
        resetTransportControls();
      },
    }),
    [videoPlayer, setDrawingData, resetTransportControls, currentViewEventId, resetFlyoutFlag, onComplete],
  );
}

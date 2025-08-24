import { useCallback } from 'react';
import type { UseRecordingSessionReturn } from '../../../hooks/useRecordingSession';
import type { VideoPlayer } from '../../../types/videoPlayer';

export interface UseVideoControlsReturn
{
  togglePlayPause: () => void;
  seekVideo: (seconds: number) => void;
  seekToTime: (time: number) => void;
  handlePlaybackRateChange: (rate: number) => void;
}

export function useVideoControls(
  videoPlayer: VideoPlayer,
  isRecording: boolean,
  recordingSession: UseRecordingSessionReturn,
  dismissCoachingPoint: () => void,
): UseVideoControlsReturn
{
  const togglePlayPause = useCallback(() =>
  {
    dismissCoachingPoint();
    if (isRecording)
    {
      const currentVideoTime = videoPlayer.getCurrentTime();
      const action = videoPlayer.isPlaying ? 'pause' : 'play';
      recordingSession.recordPlayPauseEvent(action, currentVideoTime);
    }
    videoPlayer.togglePlayPause();
  }, [dismissCoachingPoint, isRecording, recordingSession, videoPlayer]);

  const seekVideo = useCallback((seconds: number) =>
  {
    dismissCoachingPoint();
    if (isRecording)
    {
      const fromTime = videoPlayer.getCurrentTime();
      const toTime = fromTime + seconds;
      recordingSession.recordSeekEvent(fromTime, toTime);
    }
    videoPlayer.seekVideo(seconds);
  }, [dismissCoachingPoint, isRecording, recordingSession, videoPlayer]);

  const seekToTime = useCallback((time: number) =>
  {
    dismissCoachingPoint();
    if (isRecording)
    {
      const fromTime = videoPlayer.getCurrentTime();
      recordingSession.recordSeekEvent(fromTime, time);
    }
    videoPlayer.seekToTime(time);
  }, [dismissCoachingPoint, isRecording, recordingSession, videoPlayer]);

  const handlePlaybackRateChange = useCallback((rate: number) =>
  {
    dismissCoachingPoint();
    videoPlayer.setPlaybackRate(rate);
    if (isRecording)
    {
      recordingSession.recordChangeSpeedEvent(rate);
    }
  }, [dismissCoachingPoint, isRecording, recordingSession, videoPlayer]);

  return { togglePlayPause, seekVideo, seekToTime, handlePlaybackRateChange };
}

import { useCallback, useState } from 'react';
import type { UseAudioRecordingReturn } from '../../../hooks/useAudioRecording';
import type { UseRecordingSessionReturn } from '../../../hooks/useRecordingSession';
import type { Drawing, RecordingStartEventData } from '../../../types/drawing';
import type { VideoPlayer } from '../../../types/videoPlayer';

export interface RecordingData
{
  audioBlob: Blob | null;
  recordingEvents: any[];
  recordingDuration: number;
}

export interface UseRecordingControlsReturn
{
  isRecording: boolean;
  startRecording: () => Promise<number | null>; // returns start timestamp (seconds) or null
  stopRecording: () => Promise<RecordingData | null>;
}

export function useRecordingControls(
  videoPlayer: VideoPlayer,
  audioRecording: UseAudioRecordingReturn,
  recordingSession: UseRecordingSessionReturn,
  getDrawingData: () => Drawing[],
): UseRecordingControlsReturn
{
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async (): Promise<number | null> =>
  {
    // Capture current time and pause video
    const recordingStartTime = videoPlayer.getCurrentTime();
    if (videoPlayer.isPlaying)
    {
      try
      {
        videoPlayer.pauseVideo();
      }
      catch
      {
      }
    }

    // Start audio
    const audioStarted = await audioRecording.startRecording();
    if (!audioStarted)
    {
      setIsRecording(false);
      return null;
    }

    // Capture initial state
    let playbackSpeed = 1.0;
    try
    {
      playbackSpeed = videoPlayer.getPlaybackRate();
    }
    catch
    {
    }

    const initialState: RecordingStartEventData = {
      playbackSpeed,
      videoTimestamp: recordingStartTime * 1000,
      existingDrawings: getDrawingData(),
    };

    // Start recording session
    recordingSession.startRecordingSession(initialState);
    setIsRecording(true);
    return recordingStartTime;
  }, [videoPlayer, audioRecording, recordingSession, getDrawingData]);

  const stopRecording = useCallback(async (): Promise<RecordingData | null> =>
  {
    // Stop audio
    const audioBlob = await audioRecording.stopRecording();
    // Stop session
    const capturedEvents = recordingSession.stopRecordingSession();
    setIsRecording(false);

    return {
      audioBlob,
      recordingEvents: capturedEvents,
      recordingDuration: audioRecording.recordingTime,
    };
  }, [audioRecording, recordingSession]);

  return { isRecording, startRecording, stopRecording };
}

import { useCallback, useRef, useState } from 'react';
import type { Drawing } from '../types/drawing';

export interface RecordingEvent
{
  type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed';
  timestamp: number; // Milliseconds from recording start
  data: any; // Event-specific data
}

export interface PlayPauseEventData
{
  action: 'play' | 'pause';
  videoTimestamp: number; // Current video time in seconds
}

export interface SeekEventData
{
  fromTime: number; // Previous video time in seconds
  toTime: number; // New video time in seconds
}

export interface DrawEventData
{
  drawings: Drawing[];
  canvasDimensions: { width: number; height: number; };
}

export interface ChangeSpeedEventData
{
  speed: number; // Playback rate (0.5, 1, 1.25, 1.5, 2, etc.)
}

export interface UseRecordingSessionReturn
{
  isRecording: boolean;
  recordingEvents: RecordingEvent[];
  recordingStartTime: number | null;
  startRecordingSession: () => void;
  stopRecordingSession: () => RecordingEvent[];
  recordPlayPauseEvent: (action: 'play' | 'pause', videoTimestamp: number) => void;
  recordSeekEvent: (fromTime: number, toTime: number) => void;
  recordDrawEvent: (drawings: Drawing[], canvasDimensions: { width: number; height: number; }) => void;
  recordChangeSpeedEvent: (speed: number) => void;
}

/**
 * Custom hook for managing recording session events
 * Captures user interactions during a coaching session recording
 */
export const useRecordingSession = (): UseRecordingSessionReturn =>
{
  const [isRecording, setIsRecording] = useState(false);
  const [recordingEvents, setRecordingEvents] = useState<RecordingEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  const lastDrawingsRef = useRef<Drawing[]>([]);
  const lastCanvasDimensionsRef = useRef<{ width: number; height: number; } | null>(null);

  /**
   * Creates a timestamp relative to the recording start time
   */
  const createTimestamp = useCallback((): number =>
  {
    if (!recordingStartTime) return 0;
    return Date.now() - recordingStartTime;
  }, [recordingStartTime]);

  /**
   * Adds an event to the recording session
   */
  const addEvent = useCallback((type: RecordingEvent['type'], data: any) =>
  {
    if (!isRecording) return;

    const timestamp = createTimestamp();
    const event: RecordingEvent = {
      type,
      timestamp,
      data,
    };

    setRecordingEvents(prev =>
    {
      return [...prev, event];
    });
  }, [isRecording, createTimestamp]);

  /**
   * Records a play/pause event
   */
  const recordPlayPauseEvent = useCallback((action: 'play' | 'pause', videoTimestamp: number) =>
  {
    const eventData: PlayPauseEventData = {
      action,
      videoTimestamp,
    };
    addEvent(action, eventData);
  }, [addEvent]);

  /**
   * Records a seek event
   */
  const recordSeekEvent = useCallback((fromTime: number, toTime: number) =>
  {
    const eventData: SeekEventData = {
      fromTime,
      toTime,
    };
    addEvent('seek', eventData);
  }, [addEvent]);

  /**
   * Records a draw event
   */
  const recordDrawEvent = useCallback((drawings: Drawing[], canvasDimensions: { width: number; height: number; }) =>
  {
    const eventData: DrawEventData = {
      drawings: [...drawings], // Create a copy
      canvasDimensions: { ...canvasDimensions },
    };
    addEvent('draw', eventData);
  }, [addEvent]);

  /**
   * Records a speed change event
   */
  const recordChangeSpeedEvent = useCallback((speed: number) =>
  {
    const eventData: ChangeSpeedEventData = {
      speed,
    };
    addEvent('change_speed', eventData);
  }, [addEvent]);

  /**
   * Starts a new recording session
   */
  const startRecordingSession = useCallback(() =>
  {
    const startTime = Date.now();
    setIsRecording(true);
    setRecordingStartTime(startTime);
    setRecordingEvents([]);
    lastDrawingsRef.current = [];
    lastCanvasDimensionsRef.current = null;
  }, []);

  /**
   * Stops the recording session and returns all captured events
   */
  const stopRecordingSession = useCallback((): RecordingEvent[] =>
  {
    setIsRecording(false);

    const events = [...recordingEvents];

    // Reset state
    setRecordingStartTime(null);
    setRecordingEvents([]);
    lastDrawingsRef.current = [];
    lastCanvasDimensionsRef.current = null;

    return events;
  }, [recordingEvents, recordingStartTime]);

  return {
    isRecording,
    recordingEvents,
    recordingStartTime,
    startRecordingSession,
    stopRecordingSession,
    recordPlayPauseEvent,
    recordSeekEvent,
    recordDrawEvent,
    recordChangeSpeedEvent,
  };
};

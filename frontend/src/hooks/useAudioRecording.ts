import { useCallback, useRef, useState } from 'react';

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  error: string | null;
}

export interface UseAudioRecordingReturn extends AudioRecordingState {
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
}

/**
 * Custom hook for managing audio recording functionality
 * Provides comprehensive control over audio recording with error handling
 */
export const useAudioRecording = (): UseAudioRecordingReturn => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates the recording time every 100ms
   */
  const updateRecordingTime = useCallback(() => {
    if (startTimeRef.current) {
      setRecordingTime(Date.now() - startTimeRef.current);
    }
  }, []);

  /**
   * Starts the recording timer
   */
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(updateRecordingTime, 100);
  }, [updateRecordingTime]);

  /**
   * Stops the recording timer
   */
  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Cleans up media resources
   */
  const cleanupMedia = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
  }, []);

  /**
   * Starts audio recording
   * @returns Promise<boolean> - true if recording started successfully
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    console.log('🎤 Starting audio recording...');
    
    try {
      setError(null);

      // Request microphone permission
      console.log('🔒 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('✅ Microphone access granted');
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      // Check for supported MIME types in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }

      console.log('🎵 Selected audio format:', selectedMimeType);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000, // 128kbps for good quality
      });

      mediaRecorderRef.current = mediaRecorder;

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('📦 Audio chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: selectedMimeType 
        });
        console.log('🎵 Audio recording completed:', {
          finalSize: audioBlob.size,
          mimeType: audioBlob.type,
          chunks: audioChunksRef.current.length
        });
        setAudioBlob(audioBlob);
        setIsRecording(false);
        setIsPaused(false);
        stopTimer();
        cleanupMedia();
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording failed. Please try again.');
        setIsRecording(false);
        setIsPaused(false);
        stopTimer();
        cleanupMedia();
      };

      // Start recording
      console.log('▶️ Starting MediaRecorder...');
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      startTimer();

      console.log('✅ Audio recording started successfully');
      return true;
    } catch (err) {
      console.error('❌ Error starting recording:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError(`Recording failed: ${err.message}`);
        }
      } else {
        setError('Failed to start recording. Please check your microphone and try again.');
      }
      
      cleanupMedia();
      return false;
    }
  }, [startTimer, stopTimer, cleanupMedia]);

  /**
   * Stops audio recording
   */
  const stopRecording = useCallback(() => {
    console.log('⏹️ Stopping audio recording...');
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      console.log('📤 MediaRecorder stop signal sent');
      // The onstop event will handle state updates and cleanup
    } else {
      console.warn('⚠️ Cannot stop recording - no active MediaRecorder or not recording');
    }
  }, [isRecording]);

  /**
   * Pauses audio recording
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [isRecording, isPaused, stopTimer]);

  /**
   * Resumes audio recording
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [isRecording, isPaused, startTimer]);

  /**
   * Clears the current recording and resets state
   */
  const clearRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
    audioChunksRef.current = [];
    cleanupMedia();
  }, [isRecording, stopRecording, cleanupMedia]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
};

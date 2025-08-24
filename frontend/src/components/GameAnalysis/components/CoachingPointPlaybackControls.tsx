import React from 'react';
import { FaPause, FaPlay, FaSpinner, FaStop } from 'react-icons/fa';
import { formatTime } from '../utils/time';

export interface PlaybackStateProps
{
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  totalEvents: number;
  duration: number; // seconds
  currentTime: number; // seconds
  progress: number; // 0-100
}

interface CoachingPointPlaybackControlsProps
{
  state: PlaybackStateProps;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export const CoachingPointPlaybackControls: React.FC<CoachingPointPlaybackControlsProps> = (
  { state, onPlay, onPause, onStop },
) =>
{
  const { isLoading, isPlaying, error, totalEvents, duration, currentTime, progress } = state;

  return (
    <div className='playback-controls'>
      <h5>Playback Recording:</h5>

      {/* Event Count Display */}
      {totalEvents > 0 && (
        <div className='event-info'>
          <span className='event-count'>📽️ {totalEvents} recorded events</span>
        </div>
      )}

      {/* Error Display */}
      {error && <div className='playback-error'>❌ {error}</div>}

      {/* Loading State */}
      {isLoading && <div className='playback-loading'>⏳ Loading audio...</div>}

      {/* Progress Bar */}
      {duration > 0 && (
        <div className='progress-container'>
          <div className='progress-bar'>
            <div className='progress-fill' style={{ width: `${progress}%` }} />
          </div>
          <div className='time-display'>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className='playback-buttons'>
        <button
          onClick={onPlay}
          className='btn btn-success'
          disabled={isLoading || isPlaying}
          title='Start or resume playback'
        >
          {isLoading ? <FaSpinner className='spinning' /> : <FaPlay />}
        </button>

        <button onClick={onPause} className='btn btn-warning' disabled={!isPlaying} title='Pause playback'>
          <FaPause />
        </button>

        <button
          onClick={onStop}
          className='btn btn-error'
          disabled={!isPlaying && currentTime === 0}
          title='Stop playback and reset'
        >
          <FaStop />
        </button>
      </div>

      {/* Playback Status */}
      {(isPlaying || currentTime > 0) && (
        <div className='playback-status'>
          {isPlaying ?
            <span className='status-playing'>🎵 Playing coaching session...</span> :
            currentTime > 0 ?
            <span className='status-paused'>⏸️ Playback paused</span> :
            null}
        </div>
      )}
    </div>
  );
};

export default CoachingPointPlaybackControls;

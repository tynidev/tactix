import React, { useEffect, useState, useRef } from 'react';
import { CONFIG } from '../../types/config';
import './TransportControl.css';

interface TransportControlProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentPlaybackRate: number;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekTo: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const TransportControl: React.FC<TransportControlProps> = ({
  isPlaying,
  currentTime,
  duration,
  currentPlaybackRate,
  onTogglePlayPause,
  onSeek,
  onSeekTo,
  onPlaybackRateChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    onSeekTo(Math.max(0, Math.min(duration, newTime)));
  };

  const handleTimelineDrag = (e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    setDragTime(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      onSeekTo(dragTime);
      setIsDragging(false);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = percentage * duration;
        setDragTime(newTime);
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, duration]);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercentage = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className="transport-control">
      <div className="transport-main">
        {/* Transport Controls - Left */}
        <div className="transport-buttons">
          <button
            className="transport-btn"
            onClick={() => onSeek(-CONFIG.video.seekAmount)}
            title="Rewind (A/←)"
          >
            ⏮
          </button>
          <button
            className="transport-btn play-pause"
            onClick={onTogglePlayPause}
            title="Play/Pause (S/Space)"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="transport-btn"
            onClick={() => onSeek(CONFIG.video.seekAmount)}
            title="Forward (D/→)"
          >
            ⏭
          </button>
        </div>

        {/* Timeline - Center */}
        <div className="timeline-container">
          <span className="time-display">{formatTime(displayTime)}</span>
          <div
            ref={timelineRef}
            className="timeline"
            onMouseDown={handleMouseDown}
            onMouseMove={handleTimelineDrag}
          >
            <div className="timeline-track">
              <div 
                className="timeline-progress" 
                style={{ width: `${progressPercentage}%` }}
              />
              <div 
                className="timeline-playhead" 
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>

        {/* Speed Controls - Right */}
        <div className="speed-controls">
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.slow ? 'active' : ''}`}
            onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.slow)}
            title="0.5x Speed"
          >
            0.5x
          </button>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.normal ? 'active' : ''}`}
            onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.normal)}
            title="Normal Speed"
          >
            1x
          </button>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.fast ? 'active' : ''}`}
            onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.fast)}
            title="2x Speed"
          >
            2x
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransportControl;
